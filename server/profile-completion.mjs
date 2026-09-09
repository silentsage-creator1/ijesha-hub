export const requiredStudentFields = ['first_name','last_name','date_of_birth','gender','phone_number','home_address','state','lga','city_town']
export function studentProfileComplete(details, photo) {
  return Boolean(photo) && requiredStudentFields.every(key => typeof details[key] === 'string' && details[key].trim().length > 0)
}
