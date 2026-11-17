import getEventData from "./eventData.js";
import langs from "./langs.js";

export default function () {
  return getEventData().items.flatMap((event) => langs.map((language) => ({ event, language })));
}
