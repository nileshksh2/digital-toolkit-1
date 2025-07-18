import bcrypt from 'bcrypt';
import { getDatabase } from './init';

async function seedData(): Promise<void> {
  const db = await getDatabase();

  console.log('🌱 Seeding database with sample data...');

  try {
    // Create users
    const users = [
      {
        username: 'admin',
        email: 'admin@company.com',
        password: 'admin123',
        first_name: 'System',
        last_name: 'Administrator',
        role: 'system_admin'
      },
      {
        username: 'pm1',
        email: 'pm@company.com',
        password: 'pm123',
        first_name: 'Project',
        last_name: 'Manager',
        role: 'project_manager'
      },
      {
        username: 'dev1',
        email: 'developer@company.com',
        password: 'dev123',
        first_name: 'John',
        last_name: 'Developer',
        role: 'team_member'
      },
      {
        username: 'customer1',
        email: 'customer@client.com',
        password: 'customer123',
        first_name: 'Jane',
        last_name: 'Customer',
        role: 'customer'
      }
    ];

    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      
      await db.run(`
        INSERT OR IGNORE INTO users (
          username, email, password_hash, first_name, last_name, role, 
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        user.username,
        user.email,
        hashedPassword,
        user.first_name,
        user.last_name,
        user.role
      ]);
    }

    // Create phases
    const phases = [
      { name: 'Design', sequence_order: 1, description: 'Requirements gathering and system design' },
      { name: 'Configuration', sequence_order: 2, description: 'System configuration and setup' },
      { name: 'Testing', sequence_order: 3, description: 'Testing and quality assurance' },
      { name: 'Promotion', sequence_order: 4, description: 'Production deployment and go-live' }
    ];

    for (const phase of phases) {
      await db.run(`
        INSERT OR IGNORE INTO phases (
          name, sequence_order, description, created_at, updated_at
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [phase.name, phase.sequence_order, phase.description]);
    }

    // Create sample customer
    await db.run(`
      INSERT OR IGNORE INTO customers (
        name, contact_email, contact_phone, organization, 
        portal_url_key, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      'Acme Corporation',
      'contact@acme.com',
      '+1-555-0123',
      'Acme Corp',
      'acme-portal-key-123'
    ]);

    // Get IDs
    const customer = await db.queryFirst('SELECT id FROM customers WHERE name = ?', ['Acme Corporation']);
    const pmUser = await db.queryFirst('SELECT id FROM users WHERE email = ?', ['pm@company.com']);
    const adminUser = await db.queryFirst('SELECT id FROM users WHERE email = ?', ['admin@company.com']);

    // Create sample template
    const templateResult = await db.run(`
      INSERT INTO templates (
        name, description, category, is_active, 
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, true, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      'Standard HRP Implementation',
      'Standard template for HRP implementation projects',
      'HRP',
      adminUser?.id || 1
    ]);

    // Create sample epic
    const epicResult = await db.run(`
      INSERT INTO epics (
        title, description, customer_id, template_id, current_phase_id,
        status, priority, start_date, end_date, estimated_hours,
        project_manager_id, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, 'in_progress', 'high', ?, ?, 480, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      'Acme Corp HRP Implementation',
      'Complete HRP system implementation for Acme Corporation including payroll, benefits, and time tracking modules.',
      customer?.id,
      templateResult.lastID,
      new Date().toISOString().split('T')[0], // today
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days from now
      pmUser?.id || 2,
      adminUser?.id || 1
    ]);

    const epicId = epicResult.lastID;

    // Create epic phases
    const phaseRows = await db.query('SELECT id, sequence_order FROM phases ORDER BY sequence_order');
    for (const phase of phaseRows) {
      await db.run(`
        INSERT INTO epic_phases (
          epic_id, phase_id, status, completion_percentage, created_at, updated_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        epicId,
        phase.id,
        phase.sequence_order === 1 ? 'in_progress' : 'not_started',
        phase.sequence_order === 1 ? 25 : 0
      ]);
    }

    // Add team members to epic
    const devUser = await db.queryFirst('SELECT id FROM users WHERE email = ?', ['developer@company.com']);
    const teamMembers = [pmUser?.id, devUser?.id].filter(Boolean);
    
    for (const userId of teamMembers) {
      await db.run(`
        INSERT INTO epic_team_members (
          epic_id, user_id, role, assigned_at
        ) VALUES (?, ?, 'team_member', CURRENT_TIMESTAMP)
      `, [epicId, userId]);
    }

    // Create sample stories
    const stories = [
      {
        title: 'Employee Data Migration',
        description: 'Migrate existing employee data from legacy system',
        phase_id: 1,
        estimated_hours: 40,
        sequence_order: 1
      },
      {
        title: 'Payroll Configuration',
        description: 'Configure payroll rules and calculations',
        phase_id: 2,
        estimated_hours: 60,
        sequence_order: 2
      },
      {
        title: 'Benefits Setup',
        description: 'Configure employee benefits and enrollment',
        phase_id: 2,
        estimated_hours: 30,
        sequence_order: 3
      }
    ];

    for (const story of stories) {
      const storyResult = await db.run(`
        INSERT INTO stories (
          epic_id, title, description, phase_id, status, priority,
          estimated_hours, sequence_order, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'not_started', 'medium', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        epicId,
        story.title,
        story.description,
        story.phase_id,
        story.estimated_hours,
        story.sequence_order,
        pmUser?.id || 2
      ]);

      // Create sample tasks for the first story
      if (story.sequence_order === 1) {
        const storyId = storyResult.lastID;
        
        const tasks = [
          {
            title: 'Extract employee data from legacy system',
            description: 'Export all employee records with validation',
            estimated_hours: 16
          },
          {
            title: 'Data cleansing and validation',
            description: 'Clean and validate employee data for import',
            estimated_hours: 12
          },
          {
            title: 'Import data to HRP system',
            description: 'Import validated employee data',
            estimated_hours: 12
          }
        ];

        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          await db.run(`
            INSERT INTO tasks (
              story_id, title, description, status, priority,
              estimated_hours, sequence_order, assigned_to, created_by,
              created_at, updated_at
            ) VALUES (?, ?, ?, 'not_started', 'medium', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [
            storyId,
            task.title,
            task.description,
            task.estimated_hours,
            i + 1,
            devUser?.id,
            pmUser?.id || 2
          ]);
        }
      }
    }

    // Create customer portal settings
    await db.run(`
      INSERT INTO customer_portal_settings (
        customer_id, epic_id, visibility_settings, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      customer?.id,
      epicId,
      JSON.stringify({
        show_phases: true,
        show_stories: true,
        show_tasks: true,
        show_subtasks: false,
        show_comments: true,
        show_attachments: true,
        show_timeline: true,
        show_team_members: false
      })
    ]);

    // Create sample comment
    await db.run(`
      INSERT INTO comments (
        entity_type, entity_id, content, is_internal, author_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, false, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      'epic',
      epicId,
      'Welcome to your HRP implementation project! We\'re excited to work with you.',
      pmUser?.id || 2
    ]);

    console.log('✅ Database seeded successfully');
    console.log('\n📊 Sample data created:');
    console.log('  - 4 users (admin, project manager, developer, customer)');
    console.log('  - 1 customer (Acme Corporation)');
    console.log('  - 1 epic with 3 stories and tasks');
    console.log('  - 4 phases (Design, Configuration, Testing, Promotion)');
    console.log('  - Customer portal configuration');
    console.log('  - Sample comment');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run seeding
seedData()
  .then(() => {
    console.log('🎉 Database seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  });