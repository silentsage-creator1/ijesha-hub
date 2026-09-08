import { createClient } from 'npm:@supabase/supabase-js@2'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const authorization = request.headers.get('Authorization') ?? ''

    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!url || !serviceKey || !anonKey) {
      throw new Error('Supabase environment variables are not configured.')
    }

    const admin = createClient(url, serviceKey)

    const caller = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    })

    // Verify the person making the request
    const {
      data: { user },
      error: userError,
    } = await caller.auth.getUser()

    if (userError || !user) {
      throw new Error('Please sign in again.')
    }

    // Check caller's role
    const { data: callerProfile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !callerProfile) {
      throw new Error('Your user profile could not be found.')
    }

    if (!['admin', 'manager'].includes(callerProfile.role)) {
      throw new Error(
        'You are not allowed to create students.'
      )
    }

    const body = await request.json()

    const required = [
      'firstName',
      'lastName',
      'dateOfBirth',
      'gender',
      'phone',
      'email',
      'password',
      'courseId',
      'cohortId',
      'enrollmentDate',
    ]

    for (const key of required) {
      if (!String(body[key] ?? '').trim()) {
        throw new Error(
          `Missing required student information: ${key}`
        )
      }
    }

    if (String(body.password).length < 6) {
      throw new Error(
        'The password must be at least 6 characters.'
      )
    }

    const email = String(body.email).trim().toLowerCase()

    const name = [
      body.firstName,
      body.middleName,
      body.lastName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()

    // Make sure the cohort belongs to the selected course
    const { data: cohort, error: cohortError } = await admin
      .from('cohorts')
      .select('id, course_id, name')
      .eq('id', body.cohortId)
      .eq('course_id', body.courseId)
      .single()

    if (cohortError || !cohort) {
      throw new Error(
        'Choose a cohort belonging to the selected course.'
      )
    }

    // Create authentication account
    const {
      data: created,
      error: createError,
    } = await admin.auth.admin.createUser({
      email,
      password: String(body.password),
      email_confirm: true,
      user_metadata: {
        full_name: name,
        role: 'student',
      },
    })

    if (createError || !created.user) {
      throw new Error(
        createError?.message ??
          'Student account could not be created.'
      )
    }

    const authUserId = created.user.id

    // Make sure the profile exists and is a student
    const { error: profileUpsertError } = await admin
      .from('profiles')
      .upsert(
        {
          id: authUserId,
          full_name: name,
          role: 'student',
          approval_status: 'approved',
        },
        {
          onConflict: 'id',
        }
      )

    if (profileUpsertError) {
      throw new Error(profileUpsertError.message)
    }

    // Create the student roster record
    const {
      data: student,
      error: studentError,
    } = await admin
      .from('students')
      .insert({
        profile_id: authUserId,
        full_name: name,
        email,
        track: body.courseName ?? null,
        cohort: cohort.name,
        status: 'new',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (studentError || !student) {
      // Clean up the Auth account if the student record fails
      await admin.auth.admin.deleteUser(authUserId)

      throw new Error(
        studentError?.message ??
          'Student roster record could not be created.'
      )
    }

    // Create enrollment
    const { error: enrollmentError } = await admin
      .from('enrollments')
      .insert({
        student_id: student.id,
        cohort_id: cohort.id,
        completion_status: 'in_progress',
        created_at: body.enrollmentDate,
      })

    if (enrollmentError) {
      await admin
        .from('students')
        .delete()
        .eq('id', student.id)

      await admin.auth.admin.deleteUser(authUserId)

      throw new Error(enrollmentError.message)
    }

    // Save student personal details
    const {
      error: detailError,
    } = await admin
      .from('student_profile_details')
      .upsert(
        {
          student_id: student.id,
          first_name: String(body.firstName).trim(),
          middle_name:
            body.middleName?.trim() || null,
          last_name: String(body.lastName).trim(),
          date_of_birth: body.dateOfBirth,
          gender: body.gender,
          phone_number: String(body.phone).trim(),
        },
        {
          onConflict: 'student_id',
        }
      )

    if (detailError) {
      await admin
        .from('enrollments')
        .delete()
        .eq('student_id', student.id)

      await admin
        .from('students')
        .delete()
        .eq('id', student.id)

      await admin.auth.admin.deleteUser(authUserId)

      throw new Error(detailError.message)
    }

    return Response.json(
      {
        success: true,
        studentId: student.id,
        userId: authUserId,
      },
      {
        status: 201,
        headers,
      }
    )
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create student.',
      },
      {
        status: 400,
        headers,
      }
    )
  }
})