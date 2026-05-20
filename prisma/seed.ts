import { db } from '@/lib/db';
import { hash } from 'bcryptjs';

async function seed() {
  console.log('Seeding database...');

  // Seed Global Admin
  const adminPassword = await hash('admin123', 12);
  const admin = await db.globalUser.upsert({
    where: { email: 'admin@schoolmansys.co.ke' },
    update: {},
    create: {
      email: 'admin@schoolmansys.co.ke',
      passwordHash: adminPassword,
      name: 'Platform Administrator',
      role: 'super_admin',
      isActive: true,
    },
  });
  console.log('Created global admin:', admin.email);

  // Seed Plans
  const basicPlan = await db.plan.upsert({
    where: { id: 'plan_basic' },
    update: {},
    create: {
      id: 'plan_basic',
      name: 'Basic',
      price: 5000,
      durationDays: 365,
      maxStudents: 100,
      maxStaff: 15,
      features: JSON.stringify({
        academics: true,
        fees: true,
        attendance: true,
        transport: false,
        report_cards: true,
        bulk_import: false,
      }),
    },
  });

  const standardPlan = await db.plan.upsert({
    where: { id: 'plan_standard' },
    update: {},
    create: {
      id: 'plan_standard',
      name: 'Standard',
      price: 15000,
      durationDays: 365,
      maxStudents: 500,
      maxStaff: 50,
      features: JSON.stringify({
        academics: true,
        fees: true,
        attendance: true,
        transport: true,
        report_cards: true,
        bulk_import: true,
      }),
    },
  });

  const premiumPlan = await db.plan.upsert({
    where: { id: 'plan_premium' },
    update: {},
    create: {
      id: 'plan_premium',
      name: 'Premium',
      price: 35000,
      durationDays: 365,
      maxStudents: 2000,
      maxStaff: 200,
      features: JSON.stringify({
        academics: true,
        fees: true,
        attendance: true,
        transport: true,
        report_cards: true,
        bulk_import: true,
        payroll: true,
        nemis_export: true,
        sms_integration: true,
      }),
    },
  });
  console.log('Created plans:', basicPlan.name, standardPlan.name, premiumPlan.name);

  // Seed a demo tenant (Greenfield Academy)
  const demoTenant = await db.tenant.upsert({
    where: { subdomain: 'greenfield' },
    update: {},
    create: {
      id: 'tenant_greenfield',
      name: 'Greenfield Academy',
      subdomain: 'greenfield',
      timezone: 'Africa/Nairobi',
      status: 'active',
      planId: 'plan_standard',
      planStartDate: new Date('2026-01-01'),
      expiryDate: new Date('2027-01-01'),
    },
  });
  console.log('Created demo tenant:', demoTenant.name);

  // Seed demo tenant: default roles
  const roles = [
    { name: 'School Admin', permissions: JSON.stringify({ all: ['*'] }) },
    { name: 'Teacher', permissions: JSON.stringify({ students: ['view'], attendance: ['view', 'mark'], assessments: ['view', 'create', 'edit'], grades: ['view', 'create', 'edit'], report_cards: ['view', 'generate'] }) },
    { name: 'Finance Officer', permissions: JSON.stringify({ students: ['view'], fees: ['view', 'collect', 'refund'], fee_structures: ['view', 'create', 'edit'], reports: ['view'] }) },
    { name: 'Parent', permissions: JSON.stringify({ own_children: ['view'] }) },
  ];

  for (const role of roles) {
    await db.role.upsert({
      where: { tenantId_name: { tenantId: demoTenant.id, name: role.name } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        name: role.name,
        permissions: role.permissions,
        isDefault: role.name === 'School Admin',
      },
    });
  }
  console.log('Created roles for demo tenant');

  // Seed demo tenant: academic year and terms
  const academicYear = await db.academicYear.upsert({
    where: { tenantId_name: { tenantId: demoTenant.id, name: '2026' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      name: '2026',
      startDate: new Date('2026-01-27'),
      endDate: new Date('2026-11-20'),
      isCurrent: true,
    },
  });

  const terms = [
    { name: 'Term 1', start: '2026-01-27', end: '2026-04-04' },
    { name: 'Term 2', start: '2026-05-05', end: '2026-07-25' },
    { name: 'Term 3', start: '2026-09-01', end: '2026-11-20' },
  ];

  for (const term of terms) {
    await db.term.upsert({
      where: { tenantId_academicYearId_name: { tenantId: demoTenant.id, academicYearId: academicYear.id, name: term.name } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        academicYearId: academicYear.id,
        name: term.name,
        startDate: new Date(term.start),
        endDate: new Date(term.end),
        isCurrent: term.name === 'Term 1',
      },
    });
  }
  console.log('Created academic year and terms');

  // Seed learning levels (CBC)
  const levels = [
    { name: 'Early Years', order: 1 },
    { name: 'Lower Primary', order: 2 },
    { name: 'Upper Primary', order: 3 },
    { name: 'Junior School', order: 4 },
  ];

  for (const level of levels) {
    await db.learningLevel.upsert({
      where: { tenantId_name: { tenantId: demoTenant.id, name: level.name } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        name: level.name,
        levelOrder: level.order,
      },
    });
  }
  console.log('Created CBC learning levels');

  // Seed demo classes
  const lowerPrimary = await db.learningLevel.findUnique({ where: { tenantId_name: { tenantId: demoTenant.id, name: 'Lower Primary' } } });
  const upperPrimary = await db.learningLevel.findUnique({ where: { tenantId_name: { tenantId: demoTenant.id, name: 'Upper Primary' } } });
  const juniorSchool = await db.learningLevel.findUnique({ where: { tenantId_name: { tenantId: demoTenant.id, name: 'Junior School' } } });

  const demoClasses = [
    { name: 'Grade 1 West', levelId: lowerPrimary?.id, capacity: 35 },
    { name: 'Grade 2 East', levelId: lowerPrimary?.id, capacity: 40 },
    { name: 'Grade 3 North', levelId: lowerPrimary?.id, capacity: 40 },
    { name: 'Grade 4 East', levelId: upperPrimary?.id, capacity: 40 },
    { name: 'Grade 5 West', levelId: upperPrimary?.id, capacity: 40 },
    { name: 'Grade 6 South', levelId: upperPrimary?.id, capacity: 40 },
    { name: 'Grade 7 East', levelId: juniorSchool?.id, capacity: 45 },
    { name: 'Grade 8 North', levelId: juniorSchool?.id, capacity: 45 },
  ];

  for (const cls of demoClasses) {
    await db.class.upsert({
      where: { tenantId_name: { tenantId: demoTenant.id, name: cls.name } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        name: cls.name,
        levelId: cls.levelId!,
        capacity: cls.capacity,
      },
    });
  }
  console.log('Created demo classes');

  // Seed demo learning areas
  const learningAreas = [
    { name: 'Mathematics', code: 'MATH' },
    { name: 'English', code: 'ENG' },
    { name: 'Kiswahili', code: 'KIS' },
    { name: 'Science and Technology', code: 'SCI' },
    { name: 'Social Studies', code: 'SST' },
    { name: 'Religious Education', code: 'RE' },
    { name: 'Creative Arts', code: 'ART' },
    { name: 'Physical and Health Education', code: 'PHE' },
  ];

  for (const la of learningAreas) {
    await db.learningArea.upsert({
      where: { tenantId_name: { tenantId: demoTenant.id, name: la.name } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        name: la.name,
        code: la.code,
      },
    });
  }
  console.log('Created demo learning areas');

  // Seed demo school admin user
  const schoolAdminPassword = await hash('school123', 12);
  const schoolAdminRole = await db.role.findUnique({ where: { tenantId_name: { tenantId: demoTenant.id, name: 'School Admin' } } });
  await db.user.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: 'admin@greenfield.co.ke' } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: 'admin@greenfield.co.ke',
      passwordHash: schoolAdminPassword,
      name: 'Mrs. Jane Wanjiku',
      loginableType: 'staff',
      loginableId: null,
      roleId: schoolAdminRole?.id,
      status: 'active',
    },
  });
  console.log('Created demo school admin: admin@greenfield.co.ke / school123');

  // Seed demo students
  const grade4East = await db.class.findUnique({ where: { tenantId_name: { tenantId: demoTenant.id, name: 'Grade 4 East' } } });
  const demoStudents = [
    { adm: '2026-001', first: 'John', last: 'Kamau', gender: 'Male', dob: '2014-03-15', certNo: '1234567890' },
    { adm: '2026-002', first: 'Mary', last: 'Wanjiru', gender: 'Female', dob: '2014-07-22', certNo: '1234567891' },
    { adm: '2026-003', first: 'Peter', last: 'Otieno', gender: 'Male', dob: '2014-01-10', certNo: '1234567892' },
    { adm: '2026-004', first: 'Grace', last: 'Akinyi', gender: 'Female', dob: '2014-11-05', certNo: '1234567893' },
    { adm: '2026-005', first: 'David', last: 'Mwangi', gender: 'Male', dob: '2014-06-18', certNo: '1234567894' },
    { adm: '2026-006', first: 'Susan', last: 'Njeri', gender: 'Female', dob: '2014-09-30', certNo: '1234567895' },
    { adm: '2026-007', first: 'James', last: 'Ochieng', gender: 'Male', dob: '2014-04-12', certNo: '1234567896' },
    { adm: '2026-008', first: 'Faith', last: 'Njeri', gender: 'Female', dob: '2014-08-25', certNo: '1234567897' },
  ];

  for (const s of demoStudents) {
    const student = await db.student.upsert({
      where: { tenantId_admissionNumber: { tenantId: demoTenant.id, admissionNumber: s.adm } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        admissionNumber: s.adm,
        firstName: s.first,
        lastName: s.last,
        dateOfBirth: new Date(s.dob),
        gender: s.gender,
        birthCertNumber: s.certNo,
        status: 'active',
      },
    });

    // Enroll in Grade 4 East for current year
    if (grade4East) {
      await db.enrolment.upsert({
        where: { id: `enrol_${s.adm}` },
        update: {},
        create: {
          id: `enrol_${s.adm}`,
          tenantId: demoTenant.id,
          studentId: student.id,
          classId: grade4East.id,
          academicYearId: academicYear.id,
          status: 'active',
        },
      });
    }
  }
  console.log('Created demo students');

  // Seed demo staff
  const teacherRole = await db.role.findUnique({ where: { tenantId_name: { tenantId: demoTenant.id, name: 'Teacher' } } });
  const demoStaff = [
    { emp: 'EMP001', first: 'Samuel', last: 'Kariuki', designation: 'Senior Teacher', subject: 'Mathematics' },
    { emp: 'EMP002', first: 'Rose', last: 'Muthoni', designation: 'Teacher', subject: 'English' },
    { emp: 'EMP003', first: 'Daniel', last: 'Omondi', designation: 'Teacher', subject: 'Science' },
  ];

  for (const s of demoStaff) {
    await db.staff.create({
      data: {
        id: `staff_${s.emp}`,
        tenantId: demoTenant.id,
        employeeNumber: s.emp,
        firstName: s.first,
        lastName: s.last,
        designation: s.designation,
        dateJoined: new Date('2023-01-15'),
        status: 'active',
      },
    }).catch(() => {});
  }
  console.log('Created demo staff');

  // Seed demo guardian
  const guardian = await db.guardian.create({
    data: {
      id: 'guardian_001',
      tenantId: demoTenant.id,
      firstName: 'Michael',
      lastName: 'Kamau',
      phone: '0712345678',
      email: 'michael.kamau@email.com',
      occupation: 'Businessman',
      relationship: 'parent',
      address: 'Nairobi, Kenya',
    },
  }).catch(() => db.guardian.findUnique({ where: { id: 'guardian_001' } }));
  console.log('Created demo guardian');

  // Link first student to guardian
  const firstStudent = await db.student.findUnique({ where: { tenantId_admissionNumber: { tenantId: demoTenant.id, admissionNumber: '2026-001' } } });
  if (firstStudent && guardian) {
    await db.studentGuardian.upsert({
      where: { tenantId_studentId_guardianId: { tenantId: demoTenant.id, studentId: firstStudent.id, guardianId: guardian.id } },
      update: {},
      create: {
        tenantId: demoTenant.id,
        studentId: firstStudent.id,
        guardianId: guardian.id,
        relationship: 'parent',
        isPrimary: true,
      },
    });
  }

  // Seed fee structure for Grade 4 East
  if (grade4East) {
    await db.feeStructure.upsert({
      where: { id: 'fee_g4_t1_2026' },
      update: {},
      create: {
        id: 'fee_g4_t1_2026',
        tenantId: demoTenant.id,
        name: 'Grade 4 - Term 1 2026',
        academicYearId: academicYear.id,
        classId: grade4East.id,
        totalAmount: 25000,
        breakdown: JSON.stringify([
          { item: 'Tuition Fee', amount: 15000 },
          { item: 'Activity Fee', amount: 3000 },
          { item: 'Uniform', amount: 2000 },
          { item: 'Lunch Program', amount: 5000 },
        ]),
        status: 'active',
      },
    });
  }
  console.log('Created demo fee structure');

  console.log('\n✅ Seed complete!');
  console.log('\n--- Demo Credentials ---');
  console.log('Super Admin: admin@schoolmansys.co.ke / admin123');
  console.log('School Admin: admin@greenfield.co.ke / school123');
  console.log('Demo School: Greenfield Academy (greenfield)');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
