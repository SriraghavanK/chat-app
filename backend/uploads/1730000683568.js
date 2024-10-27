const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

const User = mongoose.model('User', {
  name: String,
  email: String,
  password: String,
});

async function createTestUser() {
  try {
    const testUser = new User({
      name: 'Test User',
      email: 'testuser@example.com',
      password: 'testpassword'
    });

    await testUser.save();
    console.log('Test user created successfully:', testUser);
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    mongoose.connection.close();
  }
}

createTestUser();