import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import patientsRouter from "./patients";
import appointmentsRouter from "./appointments";
import conversationsRouter from "./conversations";
import whatsappRouter from "./whatsapp";
import automationsRouter from "./automations";
import treatmentsRouter from "./treatments";
import settingsRouter from "./settings";
import aiTrainingRouter from "./ai-training";
import clinicalRouter from "./clinical";
import billingRouter from "./billing";
import inventoryRouter from "./inventory";
import pipelineRouter from "./pipeline";
import labRouter from "./lab";
import galleryRouter from "./gallery";
import paymentPlansRouter from "./payment-plans";
import portalRouter from "./portal";
import marketingRouter from "./marketing";


const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(patientsRouter);
router.use(appointmentsRouter);
router.use(conversationsRouter);
router.use(whatsappRouter);
router.use(automationsRouter);
router.use(treatmentsRouter);
router.use(settingsRouter);
router.use(aiTrainingRouter);
router.use(clinicalRouter);
router.use(billingRouter);
router.use(inventoryRouter);
router.use(pipelineRouter);
router.use(labRouter);
router.use(galleryRouter);
router.use(paymentPlansRouter);
router.use(portalRouter);
router.use(marketingRouter);


export default router;
