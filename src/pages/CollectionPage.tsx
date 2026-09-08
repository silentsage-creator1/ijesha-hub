import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/shell/PageHeader'
import { Card } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/auth'
import { DEFAULT_OFFICIAL_COURSES } from '@/lib/courses'

export interface CollectionField {
  key: string
  label: string
  type?:
    | 'text'
    | 'datetime-local'
    | 'textarea'
    | 'select'
    | 'relation'

  options?: {
    label: string
    value: string
  }[]

  relation?: {
    table: string
    valueColumn: string
    labelColumn: string
  }
}

export function CollectionPage({
  title,
  subtitle,
  table,
  fields,
  managerRoles = ['admin', 'manager', 'trainer'],
}: {
  title: string
  subtitle: string
  table: string
  fields: CollectionField[]
  managerRoles?: string[]
}) {
  const { role, profile } = useAuth()

  const canManage = Boolean(
    role && managerRoles.includes(role)
  )

  const [rows, setRows] =
    useState<Record<string, unknown>[]>([])

  const [open, setOpen] =
    useState(false)

  const [editing, setEditing] =
    useState<Record<string, unknown> | null>(null)

  const [form, setForm] =
    useState<Record<string, string>>({})

  const [error, setError] =
    useState<string | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  /*
   * Load records from the requested table.
   */
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      setError(error.message)
    } else {
      setRows(
        (data ?? []) as Record<string, unknown>[]
      )
    }

    setLoading(false)
  }, [table])

  useEffect(() => {
    load()
  }, [load])

  /*
   * Open the Add/Edit form.
   *
   * The database ID is deliberately NOT put
   * into the form.
   */
  const begin = (
    row?: Record<string, unknown>
  ) => {
    setEditing(row ?? null)

    const initialForm: Record<string, string> = {}

    for (const field of fields) {
      /*
       * created_by is automatic.
       */
      if (field.key === 'created_by') {
        continue
      }

      /*
       * id is never a form field.
       */
      if (field.key === 'id') {
        continue
      }

      /*
       * Special case:
       *
       * The cohorts table stores course_id,
       * but the admin works with course_name.
       *
       * When editing an existing cohort,
       * we load its course name here.
       */
      if (
        table === 'cohorts' &&
        field.key === 'course_name' &&
        row?.course_id
      ) {
        initialForm.course_name = ''

        void loadCourseName(
          String(row.course_id)
        ).then((name) => {
          if (name) {
            setForm((current) => ({
              ...current,
              course_name: name,
            }))
          }
        })

        continue
      }

      initialForm[field.key] = String(
        row?.[field.key] ?? ''
      )
    }

    setForm(initialForm)
    setError(null)
    setOpen(true)
  }

  /*
   * Find the course UUID from the course name.
   *
   * The admin never sees or enters the UUID.
   */
  const findCourseId = async (
    courseName: string
  ): Promise<string | null> => {
    const cleanName = courseName.trim()

    if (!cleanName) {
      return null
    }

    const { data } = await supabase
      .from('courses')
      .select('id,name')
      .ilike('name', cleanName)
      .maybeSingle()

    if (data?.id) {
      return data.id
    }

    // Try finding by official course fallback or auto-creating
    const matchedOfficial = DEFAULT_OFFICIAL_COURSES.find(
      (c) => c.name.toLowerCase() === cleanName.toLowerCase()
    )
    if (matchedOfficial) {
      try {
        const created = await supabase
          .from('courses')
          .insert({
            name: matchedOfficial.name,
            description: `${matchedOfficial.name} training track at Ijesha Digital Hub`,
          })
          .select('id')
          .maybeSingle()
        if (created.data?.id) return created.data.id
      } catch {}
      return matchedOfficial.id
    }

    throw new Error(
      `Course "${cleanName}" was not found. Available official tracks: ${DEFAULT_OFFICIAL_COURSES.map((c) => c.name).join(', ')}`
    )
  }

  /*
   * Get course name when editing a cohort.
   */
  const loadCourseName = async (
    courseId: string
  ): Promise<string | null> => {
    const { data, error } = await supabase
      .from('courses')
      .select('name')
      .eq('id', courseId)
      .maybeSingle()

    if (error) {
      setError(error.message)
      return null
    }

    return data?.name ?? null
  }

  /*
   * Save a record.
   */
  const save = async (
    event: FormEvent
  ) => {
    event.preventDefault()

    setSaving(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {}

      /*
       * Build the normal payload.
       */
      for (const field of fields) {
        /*
         * Never allow the frontend form
         * to provide the database ID.
         */
        if (field.key === 'id') {
          continue
        }

        /*
         * created_by is handled automatically.
         */
        if (field.key === 'created_by') {
          if (!editing && profile) {
            payload.created_by = profile.id
          }

          continue
        }

        /*
         * course_name is NOT a database column
         * in cohorts.
         *
         * We handle it separately below.
         */
        if (
          table === 'cohorts' &&
          field.key === 'course_name'
        ) {
          continue
        }

        const value = form[field.key]

        payload[field.key] =
          value === '' ? null : value
      }

      /*
       * SPECIAL COHORT HANDLING
       *
       * Admin enters:
       *
       * Cyber Security
       *
       * Application finds:
       *
       * Cyber Security -> UUID
       *
       * Then saves:
       *
       * course_id = UUID
       */
      if (table === 'cohorts') {
        const courseName =
          form.course_name?.trim()

        if (!courseName) {
          throw new Error(
            'Please enter a course name.'
          )
        }

        const courseId =
          await findCourseId(courseName)

        if (!courseId) {
          throw new Error(
            `Course "${courseName}" was not found.`
          )
        }

        payload.course_id = courseId
      }

      let result

      if (editing) {
        /*
         * Editing:
         *
         * Use the existing ID only to identify
         * the record being edited.
         *
         * We never change the ID.
         */
        result = await supabase
          .from(table)
          .update(payload)
          .eq(
            'id',
            editing.id as string
          )
      } else {
        /*
         * Creating:
         *
         * NO ID is supplied here.
         *
         * Supabase/PostgreSQL generates it
         * automatically.
         */
        result = await supabase
          .from(table)
          .insert(payload)
      }

      if (result.error) {
        throw new Error(
          result.error.message
        )
      }

      setOpen(false)
      setEditing(null)
      setForm({})

      await load()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong.'
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * Delete record.
   */
  const remove = async (
    id: string
  ) => {
    const { error } =
      await supabase
        .from(table)
        .delete()
        .eq('id', id)

    if (error) {
      setError(error.message)
      return
    }

    setRows((current) =>
      current.filter(
        (row) => row.id !== id
      )
    )
  }

  /*
   * Render a normal form field.
   */
  const renderField = (
    field: CollectionField
  ) => {
    /*
     * Course name is deliberately
     * a NORMAL TEXT FIELD.
     *
     * The admin types:
     * Cyber Security
     *
     * The application finds the UUID
     * automatically when saving.
     */
    if (
      table === 'cohorts' &&
      field.key === 'course_name'
    ) {
      return (
        <input
          required
          type="text"
          className="input"
          placeholder="Enter course name"
          value={
            form.course_name ?? ''
          }
          onChange={(e) =>
            setForm({
              ...form,
              course_name:
                e.target.value,
            })
          }
        />
      )
    }

    if (
      field.type === 'textarea'
    ) {
      return (
        <textarea
          className="input min-h-24"
          value={
            form[field.key] ?? ''
          }
          onChange={(e) =>
            setForm({
              ...form,
              [field.key]:
                e.target.value,
            })
          }
        />
      )
    }

    if (
      field.type === 'select'
    ) {
      return (
        <select
          className="input"
          value={
            form[field.key] ?? ''
          }
          onChange={(e) =>
            setForm({
              ...form,
              [field.key]:
                e.target.value,
            })
          }
        >
          <option value="">
            Select {field.label}
          </option>

          {(field.options ?? []).map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}
        </select>
      )
    }

    return (
      <input
        required={
          field.key === 'name' ||
          field.key === 'title' ||
          field.key === 'topic'
        }
        type={
          field.type ?? 'text'
        }
        className="input"
        value={
          form[field.key] ?? ''
        }
        onChange={(e) =>
          setForm({
            ...form,
            [field.key]:
              e.target.value,
          })
        }
      />
    )
  }

  /*
   * Display database values.
   *
   * We deliberately hide UUIDs from the UI.
   */
  const displayValue = (
    field: CollectionField,
    row: Record<string, unknown>
  ) => {
    /*
     * Never display IDs.
     */
    if (
      field.key === 'id' ||
      field.key === 'course_id' ||
      field.key === 'created_by'
    ) {
      return null
    }

    return String(
      row[field.key] ?? '—'
    )
  }

  /*
   * Fields that should actually be
   * visible in the table.
   */
  const visibleFields = fields
    .filter(
      (field) =>
        field.key !== 'id' &&
        field.key !== 'course_id' &&
        field.key !== 'created_by'
    )
    .slice(0, 4)

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          canManage ? (
            <button
              onClick={() => begin()}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white"
            >
              <Plus size={16} />
              Add{' '}
              {title.slice(0, -1)}
            </button>
          ) : undefined
        }
      />

      {error && (
        <p className="mb-4 rounded-md bg-[var(--color-danger-100)] p-3 text-sm text-[var(--color-danger-600)]">
          {error}
        </p>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-sm text-[var(--color-ink-400)]">
            Loading{' '}
            {title.toLowerCase()}
            …
          </p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--color-ink-400)]">
            No{' '}
            {title.toLowerCase()}{' '}
            found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-[var(--color-line)] text-xs text-[var(--color-ink-400)]">
                <tr>
                  {visibleFields.map(
                    (field) => (
                      <th
                        key={
                          field.key
                        }
                        className="p-3"
                      >
                        {
                          field.label
                        }
                      </th>
                    )
                  )}

                  {canManage && (
                    <th className="p-3">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--color-line)]">
                {rows.map(
                  (row) => (
                    <tr
                      key={
                        row.id as string
                      }
                    >
                      {visibleFields.map(
                        (field) => (
                          <td
                            key={
                              field.key
                            }
                            className="p-3 text-[var(--color-ink-700)]"
                          >
                            {displayValue(
                              field,
                              row
                            )}
                          </td>
                        )
                      )}

                      {canManage && (
                        <td className="p-3">
                          <button
                            onClick={() =>
                              begin(
                                row
                              )
                            }
                            className="mr-2 text-[var(--color-harbor-600)]"
                          >
                            <Pencil
                              size={
                                16
                              }
                            />
                          </button>

                          <button
                            onClick={() =>
                              remove(
                                row.id as string
                              )
                            }
                            className="text-[var(--color-danger-600)]"
                          >
                            <Trash2
                              size={
                                16
                              }
                            />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <Modal
          title={
            editing
              ? `Edit ${title.slice(
                  0,
                  -1
                )}`
              : `Add ${title.slice(
                  0,
                  -1
                )}`
          }
          onClose={() =>
            setOpen(false)
          }
        >
          <form
            onSubmit={save}
            className="space-y-3"
          >
            {fields
              .filter(
                (field) =>
                  field.key !==
                    'created_by' &&
                  field.key !== 'id' &&
                  field.key !==
                    'course_id'
              )
              .map((field) => (
                <Field
                  key={field.key}
                  label={
                    field.label
                  }
                >
                  {renderField(
                    field
                  )}
                </Field>
              ))}

            {error && (
              <p className="text-sm text-[var(--color-danger-600)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-[var(--radius-md)] bg-[var(--color-harbor-500)] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving
                ? 'Saving…'
                : 'Save'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}