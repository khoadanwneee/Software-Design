import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  AiSummaryStatus,
  PrismaClient,
  Role,
  UploadedFileType,
  WorkshopCategory,
  WorkshopStatus
} from "@prisma/client";

const prisma = new PrismaClient();

const demoPassword = "password123";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function upsertUser(
  email: string,
  fullName: string,
  roles: Role[]
) {
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  return prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      roles,
      status: "ACTIVE"
    },
    create: {
      email,
      fullName,
      roles,
      passwordHash,
      status: "ACTIVE"
    }
  });
}

async function getOrCreateSpeaker(
  fullName: string,
  title: string,
  bio: string
) {
  const existing = await prisma.speaker.findFirst({
    where: { fullName }
  });

  if (existing) {
    return existing;
  }

  return prisma.speaker.create({
    data: {
      fullName,
      title,
      bio
    }
  });
}

async function main() {
  // =========================
  // USERS
  // =========================

  const admin = await upsertUser(
    "admin@unihub.local",
    "UniHub Admin",
    [Role.ADMIN]
  );

  const organizer = await upsertUser(
    "organizer@unihub.local",
    "Workshop Organizer",
    [Role.ORGANIZER]
  );

  const staff = await upsertUser(
    "staff@unihub.local",
    "Check-in Staff",
    [Role.CHECKIN_STAFF]
  );

  const student = await upsertUser(
    "giabao.150905@gmail.com",
    "Gia Bao",
    [Role.STUDENT]
  );

  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {
      studentCode: "SV150905",
      email: student.email,
      fullName: student.fullName,
      major: "Software Engineering",
      className: "SE-K2023",
      verifiedAt: new Date(),
      importedAt: new Date()
    },
    create: {
      userId: student.id,
      studentCode: "SV150905",
      email: student.email,
      fullName: student.fullName,
      major: "Software Engineering",
      className: "SE-K2023",
      verifiedAt: new Date(),
      importedAt: new Date()
    }
  });

  // =========================
  // ROOMS
  // =========================

  const hallA = await prisma.room.upsert({
    where: { name: "Hall A" },
    update: {
      capacity: 120,
      layoutUrl: "/rooms/hall-a.png"
    },
    create: {
      name: "Hall A",
      capacity: 120,
      layoutUrl: "/rooms/hall-a.png"
    }
  });

  const hallB = await prisma.room.upsert({
    where: { name: "Hall B" },
    update: {
      capacity: 150,
      layoutUrl: "/rooms/hall-b.png"
    },
    create: {
      name: "Hall B",
      capacity: 150,
      layoutUrl: "/rooms/hall-b.png"
    }
  });

  const hallC = await prisma.room.upsert({
    where: { name: "Hall C" },
    update: {
      capacity: 200,
      layoutUrl: "/rooms/hall-c.png"
    },
    create: {
      name: "Hall C",
      capacity: 200,
      layoutUrl: "/rooms/hall-c.png"
    }
  });

  const labA = await prisma.room.upsert({
    where: { name: "Lab A" },
    update: {
      capacity: 35,
      layoutUrl: "/rooms/lab-a.png"
    },
    create: {
      name: "Lab A",
      capacity: 35,
      layoutUrl: "/rooms/lab-a.png"
    }
  });

  const labB = await prisma.room.upsert({
    where: { name: "Lab B" },
    update: {
      capacity: 40,
      layoutUrl: "/rooms/lab-b.png"
    },
    create: {
      name: "Lab B",
      capacity: 40,
      layoutUrl: "/rooms/lab-b.png"
    }
  });

  const labC = await prisma.room.upsert({
    where: { name: "Lab C" },
    update: {
      capacity: 45,
      layoutUrl: "/rooms/lab-c.png"
    },
    create: {
      name: "Lab C",
      capacity: 45,
      layoutUrl: "/rooms/lab-c.png"
    }
  });

  const studioA = await prisma.room.upsert({
    where: { name: "Studio A" },
    update: {
      capacity: 20,
      layoutUrl: "/rooms/studio-a.png"
    },
    create: {
      name: "Studio A",
      capacity: 20,
      layoutUrl: "/rooms/studio-a.png"
    }
  });

  const studioB = await prisma.room.upsert({
    where: { name: "Studio B" },
    update: {
      capacity: 25,
      layoutUrl: "/rooms/studio-b.png"
    },
    create: {
      name: "Studio B",
      capacity: 25,
      layoutUrl: "/rooms/studio-b.png"
    }
  });

  const studioC = await prisma.room.upsert({
    where: { name: "Studio C" },
    update: {
      capacity: 20,
      layoutUrl: "/rooms/studio-c.png"
    },
    create: {
      name: "Studio C",
      capacity: 20,
      layoutUrl: "/rooms/studio-c.png"
    }
  });

  const innovationHub = await prisma.room.upsert({
    where: { name: "Innovation Hub" },
    update: {
      capacity: 80,
      layoutUrl: "/rooms/innovation-hub.png"
    },
    create: {
      name: "Innovation Hub",
      capacity: 80,
      layoutUrl: "/rooms/innovation-hub.png"
    }
  });

  const conferenceRoom = await prisma.room.upsert({
    where: { name: "Conference Room" },
    update: {
      capacity: 60,
      layoutUrl: "/rooms/conference-room.png"
    },
    create: {
      name: "Conference Room",
      capacity: 60,
      layoutUrl: "/rooms/conference-room.png"
    }
  });

  // =========================
  // SPEAKERS
  // =========================

  const speakerAi = await getOrCreateSpeaker(
    "Dr. Mai Linh",
    "AI Research Lead",
    "Chia sẻ cách dùng AI có trách nhiệm trong học tập và nghề nghiệp."
  );

  const speakerAi2 = await getOrCreateSpeaker(
    "Nguyen Quoc Bao",
    "ML Engineer",
    "Chuyên về LLM apps, RAG systems và AI automation."
  );

  const speakerCareer = await getOrCreateSpeaker(
    "Anh Hoang Phuc",
    "Engineering Manager",
    "Kinh nghiệm phỏng vấn, portfolio và làm việc nhóm trong sản phẩm phần mềm."
  );

  const speakerData = await getOrCreateSpeaker(
    "Ms. Lan Anh",
    "Data Analyst",
    "Thực hành storytelling bằng dữ liệu cho sinh viên mới đi làm."
  );

  const speakerData2 = await getOrCreateSpeaker(
    "Dang Quoc Viet",
    "Data Engineer",
    "Xây dựng data warehouse và ETL pipelines."
  );

  const speakerCloud = await getOrCreateSpeaker(
    "Tran Minh Duc",
    "Cloud Solutions Architect",
    "Có kinh nghiệm triển khai AWS và tối ưu hạ tầng cloud."
  );

  const speakerSecurity = await getOrCreateSpeaker(
    "Le Thanh Nam",
    "Cyber Security Consultant",
    "Tư vấn bảo mật ứng dụng web và incident response."
  );

  const speakerDevOps = await getOrCreateSpeaker(
    "Pham Gia Huy",
    "Senior DevOps Engineer",
    "Xây dựng CI/CD pipeline và Kubernetes platform."
  );

  const speakerMobile = await getOrCreateSpeaker(
    "Vo Khanh Linh",
    "Mobile Tech Lead",
    "Phát triển ứng dụng Flutter và React Native."
  );

  const speakerWeb = await getOrCreateSpeaker(
    "Do Tuan Kiet",
    "Frontend Architect",
    "Tối ưu frontend architecture và performance."
  );

  const speakerProduct = await getOrCreateSpeaker(
    "Bui Thao Nguyen",
    "Senior Product Manager",
    "Làm việc với product discovery và growth strategy."
  );

  const speakerDesign = await getOrCreateSpeaker(
    "Truong Bao Han",
    "Product Designer",
    "Thiết kế design system và trải nghiệm người dùng."
  );

  // =========================
  // WORKSHOPS
  // =========================

  const workshops = [
    {
      slug: "ai-career-starter",
      title: "AI Career Starter",
      description: "Workshop miễn phí về định hướng nghề nghiệp với AI.",
      category: WorkshopCategory.AI,
      roomId: hallA.id,
      startTime: new Date("2026-05-17T09:00:00+07:00"),
      endTime: new Date("2026-05-17T11:00:00+07:00"),
      capacity: 120,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerAi.id
    },
    {
      slug: "paid-product-thinking",
      title: "Product Thinking Bootcamp",
      description:
        "Workshop có phí với payment mock và QR sau webhook thành công.",
      category: WorkshopCategory.Career,
      roomId: innovationHub.id,
      startTime: new Date("2026-05-18T13:30:00+07:00"),
      endTime: new Date("2026-05-18T16:00:00+07:00"),
      capacity: 80,
      priceAmount: "99000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerProduct.id
    },
    {
      slug: "data-storytelling",
      title: "Data Storytelling",
      description: "Kể chuyện bằng dữ liệu cho sinh viên IT.",
      category: WorkshopCategory.Data,
      roomId: studioA.id,
      startTime: new Date("2026-05-19T10:00:00+07:00"),
      endTime: new Date("2026-05-19T12:00:00+07:00"),
      capacity: 20,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerData.id
    },
    {
      slug: "cloud-bootcamp",
      title: "Cloud Bootcamp",
      description: "Nền tảng cloud cơ bản, IAM và cost control.",
      category: WorkshopCategory.Cloud,
      roomId: hallB.id,
      startTime: new Date("2026-05-20T13:30:00+07:00"),
      endTime: new Date("2026-05-20T16:00:00+07:00"),
      capacity: 150,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerCloud.id
    },
    {
      slug: "secure-coding-basics",
      title: "Secure Coding Basics",
      description: "Nhận diện lỗ hổng phổ biến và cách phòng tránh.",
      category: WorkshopCategory.Security,
      roomId: labA.id,
      startTime: new Date("2026-05-21T09:00:00+07:00"),
      endTime: new Date("2026-05-21T11:00:00+07:00"),
      capacity: 35,
      priceAmount: "59000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerSecurity.id
    },
    {
      slug: "ai-foundations",
      title: "AI Foundations",
      description: "Tổng quan nền tảng AI, ML và ứng dụng thực tế.",
      category: WorkshopCategory.AI,
      roomId: hallC.id,
      startTime: new Date("2026-05-21T13:30:00+07:00"),
      endTime: new Date("2026-05-21T15:30:00+07:00"),
      capacity: 200,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerAi2.id
    },
    {
      slug: "design-systems-101",
      title: "Design Systems 101",
      description: "Thiết kế hệ thống UI nhất quán cho sản phẩm lớn.",
      category: WorkshopCategory.Design,
      roomId: hallB.id,
      startTime: new Date("2026-05-22T09:00:00+07:00"),
      endTime: new Date("2026-05-22T11:00:00+07:00"),
      capacity: 150,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerDesign.id
    },
    {
      slug: "product-discovery",
      title: "Product Discovery",
      description: "Khám phá nhu cầu người dùng và định hình MVP.",
      category: WorkshopCategory.Product,
      roomId: innovationHub.id,
      startTime: new Date("2026-05-22T13:30:00+07:00"),
      endTime: new Date("2026-05-22T15:30:00+07:00"),
      capacity: 80,
      priceAmount: "89000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerProduct.id
    },
    {
      slug: "data-warehouse-essentials",
      title: "Data Warehouse Essentials",
      description: "Mô hình kho dữ liệu và pipeline ETL cơ bản.",
      category: WorkshopCategory.Data,
      roomId: hallA.id,
      startTime: new Date("2026-05-23T09:00:00+07:00"),
      endTime: new Date("2026-05-23T11:00:00+07:00"),
      capacity: 120,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerData2.id
    },
    {
      slug: "cloud-architecture",
      title: "Cloud Architecture",
      description: "Thiết kế kiến trúc cloud an toàn và tối ưu.",
      category: WorkshopCategory.Cloud,
      roomId: hallC.id,
      startTime: new Date("2026-05-23T13:30:00+07:00"),
      endTime: new Date("2026-05-23T16:00:00+07:00"),
      capacity: 200,
      priceAmount: "109000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerCloud.id
    },
    {
      slug: "devops-ci-cd",
      title: "DevOps CI/CD",
      description: "Xây dựng pipeline CI/CD cho ứng dụng hiện đại.",
      category: WorkshopCategory.DevOps,
      roomId: labB.id,
      startTime: new Date("2026-05-17T09:00:00+07:00"),
      endTime: new Date("2026-05-17T11:00:00+07:00"),
      capacity: 40,
      priceAmount: "129000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerDevOps.id
    },
    {
      slug: "mobile-first-ui",
      title: "Mobile First UI",
      description: "Thiết kế giao diện mobile-first và tối ưu UX.",
      category: WorkshopCategory.Mobile,
      roomId: studioA.id,
      startTime: new Date("2026-05-17T13:30:00+07:00"),
      endTime: new Date("2026-05-17T15:00:00+07:00"),
      capacity: 20,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerMobile.id
    },
    {
      slug: "web-performance",
      title: "Web Performance",
      description: "Tối ưu Core Web Vitals và hiệu năng frontend.",
      category: WorkshopCategory.Web,
      roomId: studioB.id,
      startTime: new Date("2026-05-18T09:00:00+07:00"),
      endTime: new Date("2026-05-18T10:30:00+07:00"),
      capacity: 25,
      priceAmount: "49000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerWeb.id
    },
    {
      slug: "security-incident-response",
      title: "Security Incident Response",
      description: "Quy trình ứng phó sự cố bảo mật thực chiến.",
      category: WorkshopCategory.Security,
      roomId: labC.id,
      startTime: new Date("2026-05-18T13:30:00+07:00"),
      endTime: new Date("2026-05-18T15:30:00+07:00"),
      capacity: 45,
      priceAmount: "109000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerSecurity.id
    },
    {
      slug: "product-analytics",
      title: "Product Analytics",
      description: "Đo lường hành vi và tối ưu funnel sản phẩm.",
      category: WorkshopCategory.Product,
      roomId: hallB.id,
      startTime: new Date("2026-05-19T09:00:00+07:00"),
      endTime: new Date("2026-05-19T11:00:00+07:00"),
      capacity: 150,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerProduct.id
    },
    {
      slug: "ai-ethics",
      title: "AI Ethics",
      description: "Đạo đức AI và tác động xã hội.",
      category: WorkshopCategory.AI,
      roomId: hallA.id,
      startTime: new Date("2026-05-19T13:30:00+07:00"),
      endTime: new Date("2026-05-19T15:30:00+07:00"),
      capacity: 120,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerAi.id
    },
    {
      slug: "career-resume-clinic",
      title: "Career Resume Clinic",
      description: "Chỉnh sửa CV và portfolio cùng chuyên gia.",
      category: WorkshopCategory.Career,
      roomId: conferenceRoom.id,
      startTime: new Date("2026-05-20T09:00:00+07:00"),
      endTime: new Date("2026-05-20T11:00:00+07:00"),
      capacity: 60,
      priceAmount: "79000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerCareer.id
    },
    {
      slug: "designing-for-growth",
      title: "Designing for Growth",
      description: "Thiết kế sản phẩm tập trung tăng trưởng người dùng.",
      category: WorkshopCategory.Design,
      roomId: studioC.id,
      startTime: new Date("2026-05-20T13:30:00+07:00"),
      endTime: new Date("2026-05-20T15:00:00+07:00"),
      capacity: 20,
      priceAmount: "69000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerDesign.id
    },
    {
      slug: "frontend-architecture",
      title: "Frontend Architecture",
      description: "Tổ chức codebase frontend lớn và scale team.",
      category: WorkshopCategory.Web,
      roomId: hallC.id,
      startTime: new Date("2026-05-21T09:00:00+07:00"),
      endTime: new Date("2026-05-21T11:30:00+07:00"),
      capacity: 200,
      priceAmount: "89000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerWeb.id
    },
    {
      slug: "mobile-app-architecture",
      title: "Mobile App Architecture",
      description: "Kiến trúc mobile app với offline-first.",
      category: WorkshopCategory.Mobile,
      roomId: studioB.id,
      startTime: new Date("2026-05-21T13:30:00+07:00"),
      endTime: new Date("2026-05-21T15:00:00+07:00"),
      capacity: 25,
      priceAmount: "39000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerMobile.id
    },
    {
      slug: "data-viz-storytelling",
      title: "Data Viz Storytelling",
      description: "Trình bày dữ liệu hiệu quả cho stakeholder.",
      category: WorkshopCategory.Data,
      roomId: hallB.id,
      startTime: new Date("2026-05-22T09:00:00+07:00"),
      endTime: new Date("2026-05-22T11:30:00+07:00"),
      capacity: 150,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerData.id
    },
    {
      slug: "cloud-cost-optimization",
      title: "Cloud Cost Optimization",
      description: "Tối ưu chi phí cloud cho startup.",
      category: WorkshopCategory.Cloud,
      roomId: hallC.id,
      startTime: new Date("2026-05-22T13:30:00+07:00"),
      endTime: new Date("2026-05-22T15:30:00+07:00"),
      capacity: 200,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerCloud.id
    },
    {
      slug: "ai-prompting-for-devs",
      title: "AI Prompting for Devs",
      description: "Kỹ thuật prompt để tăng hiệu suất lập trình.",
      category: WorkshopCategory.AI,
      roomId: hallA.id,
      startTime: new Date("2026-05-23T09:00:00+07:00"),
      endTime: new Date("2026-05-23T11:00:00+07:00"),
      capacity: 120,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerAi2.id
    },
    {
      slug: "career-interview-prep",
      title: "Career Interview Prep",
      description: "Chuẩn bị phỏng vấn kỹ thuật và hành vi.",
      category: WorkshopCategory.Career,
      roomId: innovationHub.id,
      startTime: new Date("2026-05-23T13:30:00+07:00"),
      endTime: new Date("2026-05-23T15:30:00+07:00"),
      capacity: 80,
      priceAmount: "49000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED,
      speakerId: speakerCareer.id
    }
  ];

  for (const workshop of workshops) {
    const createdWorkshop = await prisma.workshop.upsert({
      where: {
        slug: workshop.slug
      },
      update: {
        title: workshop.title,
        description: workshop.description,
        category: workshop.category,
        roomId: workshop.roomId,
        startTime: workshop.startTime,
        endTime: workshop.endTime,
        capacity: workshop.capacity,
        priceAmount: workshop.priceAmount,
        currency: workshop.currency,
        status: workshop.status
      },
      create: {
        slug: workshop.slug,
        title: workshop.title,
        description: workshop.description,
        category: workshop.category,
        roomId: workshop.roomId,
        createdById: organizer.id,
        startTime: workshop.startTime,
        endTime: workshop.endTime,
        capacity: workshop.capacity,
        priceAmount: workshop.priceAmount,
        currency: workshop.currency,
        status: workshop.status
      }
    });

    await prisma.workshopSpeaker.createMany({
      data: [
        {
          id: `${createdWorkshop.slug}_${workshop.speakerId}`,
          workshopId: createdWorkshop.id,
          speakerId: workshop.speakerId
        }
      ],
      skipDuplicates: true
    });
  }

  // =========================
  // AI SUMMARY
  // =========================

  const aiPdfFile = await prisma.uploadedFile.upsert({
    where: {
      storageKey: "seed/ai-career-starter.pdf"
    },
    update: {
      fileType: UploadedFileType.PDF,
      fileName: "ai-career-starter.pdf",
      contentType: "application/pdf",
      sizeBytes: 204800,
      checksumSha256: sha256("seed/ai-career-starter.pdf"),
      uploadedById: organizer.id
    },
    create: {
      fileType: UploadedFileType.PDF,
      fileName: "ai-career-starter.pdf",
      contentType: "application/pdf",
      sizeBytes: 204800,
      storageKey: "seed/ai-career-starter.pdf",
      checksumSha256: sha256("seed/ai-career-starter.pdf"),
      uploadedById: organizer.id
    }
  });

  const aiWorkshop = await prisma.workshop.findUnique({
    where: {
      slug: "ai-career-starter"
    }
  });

  if (aiWorkshop) {
    await prisma.aiSummary.upsert({
      where: {
        workshopId_uploadedFileId: {
          workshopId: aiWorkshop.id,
          uploadedFileId: aiPdfFile.id
        }
      },
      update: {
        status: AiSummaryStatus.DONE,
        summary:
          "Bản tóm tắt demo: workshop giúp sinh viên hiểu cách dùng AI trong định hướng nghề nghiệp.",
        model: "mock-ai-v1",
        completedAt: new Date()
      },
      create: {
        workshopId: aiWorkshop.id,
        uploadedFileId: aiPdfFile.id,
        status: AiSummaryStatus.DONE,
        summary:
          "Bản tóm tắt demo: workshop giúp sinh viên hiểu cách dùng AI trong định hướng nghề nghiệp.",
        model: "mock-ai-v1",
        promptVersion: "summary-vi-v1"
      }
    });
  }

  // =========================
  // AUDIT LOG
  // =========================

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED_DATABASE",
      entityType: "SYSTEM",
      newValue: {
        staffId: staff.id,
        demoAccounts: [
          "admin@unihub.local",
          "organizer@unihub.local",
          "staff@unihub.local",
          "giabao.150905@gmail.com"
        ]
      }
    }
  });

  console.log("Seeded UniHub Workshop demo data.");
  console.log(`Demo password for all accounts: ${demoPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
