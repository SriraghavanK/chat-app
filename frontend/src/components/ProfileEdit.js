import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import axios from 'axios';

export default function ProfileEdit({ user, onUpdate }) {
  const [name, setName] = useState(user.name);
  const [profilePicture, setProfilePicture] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', name);
      if (profilePicture) {
        formData.append('profilePicture', profilePicture);
      }

      const response = await axios.put(`http://localhost:5000/api/users/${user._id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      onUpdate(response.data);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePicture(file);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group className="mb-3">
        <Form.Label>Name</Form.Label>
        <Form.Control
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Form.Group>
      <Form.Group className="mb-3">
        <Form.Label>Profile Picture</Form.Label>
        <Form.Control
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
      </Form.Group>
      {profilePicture && (
        <div className="mb-3">
          <img
            src={URL.createObjectURL(profilePicture)}
            alt="Profile Preview"
            style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '50%' }}
          />
        </div>
      )}
      <div className="d-flex justify-content-end">
        <Button variant="primary" type="submit">
          Save Changes
        </Button>
      </div>
    </Form>
  );
}