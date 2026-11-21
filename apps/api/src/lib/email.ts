import { readFileSync } from "node:fs";
import Handlebars from "handlebars";
import nodemailer from "nodemailer";
import { env } from "#/env";

const verificationTemplate = Handlebars.compile(
  // Read the same template from source in development and copied build output in production.
  readFileSync(new URL("../email-templates/verification-code.hbs", import.meta.url), "utf8"),
);

// Gmail keeps connections reusable; this singleton is shared by every mail operation.
const transporter = nodemailer.createTransport({
  service: "gmail",
  pool: true,
  auth: {
    user: env.MAIL_USER,
    pass: env.MAIL_PASSWORD,
  },
});

export async function sendVerificationCode(email: string, code: string) {
  // Send both HTML and plain text so the code is readable in any email app.
  await transporter.sendMail({
    from: { name: "Slate", address: env.MAIL_USER ?? "" },
    to: email,
    subject: "Your Slate verification code",
    text: `Your six-character Slate verification code is ${code}. Enter it exactly as shown. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    html: verificationTemplate({ email, code }),
  });
}
