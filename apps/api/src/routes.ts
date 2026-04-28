import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { workshopRouter } from "./modules/workshops/workshop.routes.js";
import { registrationRouter } from "./modules/registrations/registration.routes.js";
import { paymentRouter } from "./modules/payments/payment.routes.js";
import { checkinRouter } from "./modules/checkins/checkin.routes.js";
import { aiSummaryRouter } from "./modules/ai-summary/ai-summary.routes.js";
import { studentImportRouter } from "./modules/student-import/student-import.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { roomRouter } from "./modules/rooms/room.routes.js";
import { userRouter } from "./modules/users/user.routes.js";
import { notificationRouter } from "./modules/notifications/notification.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/rooms", roomRouter);
apiRouter.use("/workshops", workshopRouter);
apiRouter.use("/registrations", registrationRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/checkins", checkinRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/ai-summary", aiSummaryRouter);
apiRouter.use("/student-import", studentImportRouter);
apiRouter.use("/admin", adminRouter);
