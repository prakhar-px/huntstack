import { Router, type IRouter } from "express";
import healthRouter from "./health";
import linkedInJobsRouter from "./linkedin-jobs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(linkedInJobsRouter);

export default router;
