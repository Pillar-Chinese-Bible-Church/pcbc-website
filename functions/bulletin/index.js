import { weeklyBulletin } from "../../lib/weekly-bulletin.js";
export const onRequest = context => weeklyBulletin(context);
