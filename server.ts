import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Logging middleware for API requests
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'School RFID Access & Centralized Database',
      timestamp: new Date().toISOString()
    });
  });

  // Real-time Analytics
  app.get('/api/analytics/realtime', (req, res) => {
    try {
      const analytics = db.getRealtimeAnalytics();
      res.json(analytics);
    } catch (err: any) {
      console.error('Failed to get realtime analytics:', err);
      res.status(500).json({ error: err.message || 'Failed to compute analytics' });
    }
  });

  // Get all students
  app.get('/api/students', (req, res) => {
    try {
      const students = db.getStudents();
      res.json(students);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Lookup student by RFID
  app.get('/api/students/rfid/:tag', (req, res) => {
    try {
      const student = db.getStudentByRFID(req.params.tag);
      if (!student) {
        return res.status(404).json({ error: 'Student with this RFID tag not found' });
      }
      res.json(student);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Register a new student with RFID tag
  app.post('/api/students', (req, res) => {
    try {
      const result = db.createStudent(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(201).json(result.student);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update student details
  app.put('/api/students/:id', (req, res) => {
    try {
      const result = db.updateStudent(req.params.id, req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result.student);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete student
  app.delete('/api/students/:id', (req, res) => {
    try {
      const result = db.deleteStudent(req.params.id);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }
      res.json({ success: true, message: 'Student removed successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Scan RFID Tag (Terminal hardware / tap event)
  app.post('/api/attendance/scan', (req, res) => {
    try {
      const { rfidTag, gate, mode } = req.body;
      if (!rfidTag) {
        return res.status(400).json({ success: false, message: 'RFID Tag UID is required' });
      }

      const scanResult = db.processScan({
        rfidTag,
        gate,
        mode
      });

      if (!scanResult.success) {
        return res.status(200).json(scanResult); // 200 with success: false for clean reader handling
      }

      res.json(scanResult);
    } catch (err: any) {
      console.error('Scan processing error:', err);
      res.status(500).json({ success: false, message: err.message || 'Scan processing failed' });
    }
  });

  // Query attendance logs
  app.get('/api/attendance/logs', (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const studentId = req.query.studentId as string | undefined;
      const className = req.query.class as string | undefined;
      const type = req.query.type as 'ENTRY' | 'EXIT' | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      const logs = db.getAttendanceLogs({
        date,
        studentId,
        class: className,
        type,
        limit
      });

      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset database to initial sample state
  app.post('/api/seed/reset', (req, res) => {
    try {
      db.resetDatabase();
      res.json({ success: true, message: 'Database reset to demo state' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`School RFID Access Server running on http://localhost:${PORT}`);
  });
}

startServer();
