import ContactMessage from "../models/contactMessage.js";
import { AppError } from "../utils/appError.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createContactMessage(req, res, next) {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      throw new AppError(400, "name, email, subject and message are required");
    }
    if (!EMAIL_REGEX.test(email)) {
      throw new AppError(400, "Invalid email format");
    }
    if (message.length > 2000) {
      throw new AppError(400, "message must be 2000 characters or fewer");
    }

    await ContactMessage.create({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
    });

    res.status(201).json({ message: "Thanks — your message has been sent." });
  } catch (err) {
    next(err);
  }
}
