// Shared test data. Passwords here are TEST values only.
// The admin matches the Postman environment (adminEmail / adminPassword).

const users = [
  { name: 'Admin', tel: '0800000000', email: 'admin@dentist.com', password: 'admin123', role: 'admin' },
  { name: 'user1', tel: '0811111111', email: '6772046621@student.chula.ac.th', password: 'password123', role: 'user' },
  { name: 'user_2', tel: '0822222222', email: 'user2@example.com', password: 'password123', role: 'user' },
  { name: 'user_3', tel: '0833333333', email: 'user3@example.com', password: 'password123', role: 'user' },
];

const dentists = [
  { name: 'dentist_1', yearsOfExperience: 15, expertise: 'Orthodontics' },
  { name: 'dentist_2', yearsOfExperience: 8, expertise: 'Endodontics' },
  { name: 'dentist_3', yearsOfExperience: 12, expertise: 'Oral Surgery' },
  { name: 'dentist_4', yearsOfExperience: 5, expertise: 'Pediatric Dentistry' },
  { name: 'dentist_5', yearsOfExperience: 20, expertise: 'Prosthodontics' },
  { name: 'dentist_6', yearsOfExperience: 3, expertise: 'General Dentistry' },
  { name: 'dentist_7', yearsOfExperience: 10, expertise: 'Orthodontics' },
  { name: 'dentist_8', yearsOfExperience: 7, expertise: 'Periodontics' },
];

module.exports = { users, dentists };
