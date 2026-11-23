import { assetVersion } from "../../lib/assets.js";

export default function () {
  return { version: assetVersion() };
}
