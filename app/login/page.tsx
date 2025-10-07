'use client';

import { Button, Card, Flex, Form, Input, Typography, message } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface LoginValues {
  email: string;
  password: string;
}

const LoginPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace('/');
      }
    };

    void checkSession();
  }, [router]);

  const handleFinish = async (values: LoginValues) => {
    setLoading(true);
    const { email, password } = values;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      message.error(error.message);
    } else {
      message.success('Logged in successfully!');
      router.replace('/');
    }

    setLoading(false);
  };

  return (
    <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 24 }}>
      <Card style={{ width: 380 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>
          Sign in
        </Typography.Title>
        <Typography.Paragraph style={{ textAlign: 'center' }}>
          Use your Supabase email and password to access the chatbot.
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item
            label="Email"
            name="email"
            rules={[{ required: true, message: 'Please enter your email address.' }]}
          >
            <Input type="email" placeholder="you@example.com" size="large" />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Please enter your password.' }]}
          >
            <Input.Password placeholder="Your password" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Sign in
          </Button>
        </Form>
      </Card>
    </Flex>
  );
};

export default LoginPage;
