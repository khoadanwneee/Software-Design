import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  AiSummaryStatus,
  PrismaClient,
  QrTokenStatus,
  RegistrationStatus,
  Role,
  WorkshopStatus
} from "@prisma/client";

const prisma = new PrismaClient();

const demoPassword = "password123";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function upsertUser(email: string, fullName: string, roles: Role[]) {
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  return prisma.user.upsert({
    where: { email },
    update: { fullName, roles, status: "ACTIVE" },
    create: {
      email,
      fullName,
      roles,
      passwordHash,
      status: "ACTIVE"
    }
  });
}

async function getOrCreateSpeaker(fullName: string, title: string, bio: string) {
  const existing = await prisma.speaker.findFirst({ where: { fullName } });
  if (existing) {
    return existing;
  }
  return prisma.speaker.create({ data: { fullName, title, bio } });
}

async function main() {
  const admin = await upsertUser("admin@unihub.local", "UniHub Admin", [Role.ADMIN]);
  const organizer = await upsertUser("organizer@unihub.local", "Workshop Organizer", [Role.ORGANIZER]);
  const staff = await upsertUser("staff@unihub.local", "Check-in Staff", [Role.CHECKIN_STAFF]);
  const students = await Promise.all([
    upsertUser("student1@unihub.local", "Nguyen An", [Role.STUDENT]),
    upsertUser("student2@unihub.local", "Tran Binh", [Role.STUDENT]),
    upsertUser("student3@unihub.local", "Le Chi", [Role.STUDENT]),
    upsertUser("student4@unihub.local", "Pham Dung", [Role.STUDENT])
  ]);

  for (const [index, student] of students.entries()) {
    await prisma.studentProfile.upsert({
      where: { studentCode: `SV2026${index + 1}`.padEnd(8, "0") },
      update: {
        userId: student.id,
        email: student.email,
        fullName: student.fullName,
        verifiedAt: new Date(),
        importedAt: new Date()
      },
      create: {
        userId: student.id,
        studentCode: `SV2026${index + 1}`.padEnd(8, "0"),
        email: student.email,
        fullName: student.fullName,
        major: index % 2 === 0 ? "Software Engineering" : "Information Systems",
        className: `CTK${46 + index}`,
        verifiedAt: new Date(),
        importedAt: new Date()
      }
    });
  }

  const hallA = await prisma.room.upsert({
    where: { name: "Hall A" },
    update: { capacity: 120, layoutUrl: "/rooms/hall-a.png" },
    create: { name: "Hall A", capacity: 120, layoutUrl: "/rooms/hall-a.png" }
  });
  const labB = await prisma.room.upsert({
    where: { name: "Lab B" },
    update: { capacity: 40, layoutUrl: "/rooms/lab-b.png" },
    create: { name: "Lab B", capacity: 40, layoutUrl: "/rooms/lab-b.png" }
  });
  const studioC = await prisma.room.upsert({
    where: { name: "Studio C" },
    update: { capacity: 2, layoutUrl: "/rooms/studio-c.png" },
    create: { name: "Studio C", capacity: 2, layoutUrl: "/rooms/studio-c.png" }
  });

  const speakerAi = await getOrCreateSpeaker(
    "Dr. Mai Linh",
    "AI Research Lead",
    "Chia sẻ cách dùng AI có trách nhiệm trong học tập và nghề nghiệp."
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

  const freeWorkshop = await prisma.workshop.upsert({
    where: { slug: "ai-career-starter" },
    update: {
      title: "AI Career Starter",
      description: "Workshop miễn phí về định hướng nghề nghiệp với AI.",
      status: WorkshopStatus.PUBLISHED
    },
    create: {
      slug: "ai-career-starter",
      title: "AI Career Starter",
      description: "Workshop miễn phí về định hướng nghề nghiệp với AI.",
      category: "AI",
      roomId: hallA.id,
      createdById: organizer.id,
      startTime: new Date("2026-05-10T09:00:00+07:00"),
      endTime: new Date("2026-05-10T11:00:00+07:00"),
      capacity: 120,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED
    }
  });

  const paidWorkshop = await prisma.workshop.upsert({
    where: { slug: "paid-product-thinking" },
    update: {
      title: "Product Thinking Bootcamp",
      description: "Workshop có phí với payment mock và QR sau webhook thành công.",
      status: WorkshopStatus.PUBLISHED
    },
    create: {
      slug: "paid-product-thinking",
      title: "Product Thinking Bootcamp",
      description: "Workshop có phí với payment mock và QR sau webhook thành công.",
      category: "Career",
      roomId: labB.id,
      createdById: organizer.id,
      startTime: new Date("2026-05-11T13:30:00+07:00"),
      endTime: new Date("2026-05-11T16:00:00+07:00"),
      capacity: 40,
      priceAmount: "99000",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED
    }
  });

  const almostFullWorkshop = await prisma.workshop.upsert({
    where: { slug: "last-seat-data-storytelling" },
    update: {
      title: "Last Seat Data Storytelling",
      description: "Workshop gần hết chỗ để test tranh chấp đăng ký.",
      capacity: 2,
      status: WorkshopStatus.PUBLISHED
    },
    create: {
      slug: "last-seat-data-storytelling",
      title: "Last Seat Data Storytelling",
      description: "Workshop gần hết chỗ để test tranh chấp đăng ký.",
      category: "Data",
      roomId: studioC.id,
      createdById: organizer.id,
      startTime: new Date("2026-05-12T10:00:00+07:00"),
      endTime: new Date("2026-05-12T12:00:00+07:00"),
      capacity: 2,
      priceAmount: "0",
      currency: "VND",
      status: WorkshopStatus.PUBLISHED
    }
  });

  await prisma.workshopSpeaker.createMany({
    data: [
      { id: "ws_ai_speaker", workshopId: freeWorkshop.id, speakerId: speakerAi.id },
      { id: "ws_product_speaker", workshopId: paidWorkshop.id, speakerId: speakerCareer.id },
      { id: "ws_data_speaker", workshopId: almostFullWorkshop.id, speakerId: speakerData.id }
    ],
    skipDuplicates: true
  });

  const seededRegistration = await prisma.registration.upsert({
    where: {
      userId_workshopId: {
        userId: students[0].id,
        workshopId: almostFullWorkshop.id
      }
    },
    update: { status: RegistrationStatus.CONFIRMED },
    create: {
      userId: students[0].id,
      workshopId: almostFullWorkshop.id,
      status: RegistrationStatus.CONFIRMED,
      idempotencyKey: "seed-last-seat"
    }
  });

  const token = `qr_seed_${randomBytes(12).toString("hex")}`;
  await prisma.qrToken.upsert({
    where: { registrationId: seededRegistration.id },
    update: { status: QrTokenStatus.ACTIVE },
    create: {
      registrationId: seededRegistration.id,
      tokenHash: sha256(token),
      tokenPreview: token,
      status: QrTokenStatus.ACTIVE,
      expiresAt: new Date("2026-06-01T00:00:00+07:00")
    }
  });

  await prisma.workshop.update({
    where: { id: almostFullWorkshop.id },
    data: { registeredCount: 1 }
  });

  const aiDoc =
    (await prisma.aiDocument.findFirst({
      where: { workshopId: freeWorkshop.id, fileName: "ai-career-starter.pdf" }
    })) ??
    (await prisma.aiDocument.create({
      data: {
        workshopId: freeWorkshop.id,
        uploadedById: organizer.id,
        fileName: "ai-career-starter.pdf",
        contentType: "application/pdf",
        sizeBytes: 204800,
        storageKey: "seed/ai-career-starter.pdf"
      }
    }));

  await prisma.aiSummary.upsert({
    where: {
      workshopId_documentId: {
        workshopId: freeWorkshop.id,
        documentId: aiDoc.id
      }
    },
    update: {
      status: AiSummaryStatus.COMPLETED,
      summaryText: "Bản tóm tắt demo: workshop giúp sinh viên hiểu cách dùng AI trong định hướng nghề nghiệp."
    },
    create: {
      workshopId: freeWorkshop.id,
      documentId: aiDoc.id,
      status: AiSummaryStatus.COMPLETED,
      summaryText: "Bản tóm tắt demo: workshop giúp sinh viên hiểu cách dùng AI trong định hướng nghề nghiệp.",
      modelVersion: "mock-ai-v1",
      promptVersion: "summary-vi-v1"
    }
  });

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
          "student1@unihub.local"
        ]
      }
    }
  });

  console.log("Seeded UniHub Workshop demo data.");
  console.log(`Demo password for all accounts: ${demoPassword}`);
  console.log(`Paid workshop: ${paidWorkshop.slug}`);
  console.log(`Free workshop: ${freeWorkshop.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
