import { type Message } from "~/app/utils/types";

export const fakeMessage: Message[] = [
  {
    messageId: 0,
    chatId: 0,
    text: "",
    sender: "user",
    time: new Date(),
    hidden: true,
    meetingMessage: false,
  },
];
