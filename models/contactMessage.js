import mongoose from "mongoose";

const contactMessageSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
    maxlength: 2000,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

const ContactMessage = mongoose.model("contactmessages", contactMessageSchema);

export default ContactMessage;
