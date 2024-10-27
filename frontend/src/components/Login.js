import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button, Form, Container, Card } from 'react-bootstrap';
import { Mail, Lock } from 'lucide-react';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/login', { email, password });
      localStorage.setItem('user', JSON.stringify(response.data));
      navigate('/chat');
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please check your credentials.');
    }
  };

  return (
    <Container className="auth-container">
      <Card className="auth-card">
        <Card.Body>
          <h2 className="text-center mb-4">Login</h2>
          <Form onSubmit={handleSubmit}>
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
              Login
            </Button>
          </Form>
          <div className="text-center mt-3">
            Don't have an account? <Link to="/register">Register here</Link>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}