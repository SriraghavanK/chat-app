import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button, Form, Container, Card } from 'react-bootstrap';
import { User, Mail, Lock } from 'lucide-react';
import './Auth.css';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/register', { name, email, password });
      alert('Registration successful! Please login.');
      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed. Please try again.');
    }
  };

  return (
    <Container className="auth-container">
      <Card className="auth-card">
        <Card.Body>
          <h2 className="text-center mb-4">Register</h2>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <div className="input-group">
                <span className="input-group-text">
                  <User size={18} />
                </span>
                <Form.Control
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <div className="input-group">
                <span className="input-group-text">
                  <Mail size={18} />
                </span>
                <Form.Control
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <div className="input-group">
                <span className="input-group-text">
                  <Lock size={18} />
                </span>
                <Form.Control
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </Form.Group>
            <Button variant="primary" type="submit" className="w-100 mb-3">
              Register
            </Button>
          </Form>
          <div className="text-center mt-3">
            Already have an account? <Link to="/">Login here</Link>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}