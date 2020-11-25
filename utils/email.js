const nodemailer = require('nodemailer');
const pug = require('pug');
const htmlToText = require('html-to-text');

/*
  The idea is whenever we want to send a new email, 
  we import this Email class and then use it to send different emails for different scenarios.
  e.g. new Email(user, url).sendWelcome()
*/
module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Sameer Bhilare <${process.env.EMAIL_FROM}>`;
  }

  // different transports for prod and development
  newTransport() {
    // 1) create transporter
    /*
    transporter is basically a service that will actually send the email. e.g. gmail
    there are a couple of well-known services that Nodemailer knows how to deal with,
    and so we don't have to configure (host,port) these manually. e.g. Gmail, Yahoo, or Hotmail, etc.
    If you are using 'Gmail' service, then in your Gmail account, 
    you will actually have to activate "less secure app" option.
    Using Gmail for prod app is not recommended as you can send only 500 emails per day 
    plus you may be tagged as a spammer, which is not good.
    There are some well-known services called - SendGrid, Mailgun.

    We can use a special development service, which basically fakes to send emails to real addresses.
    But, in reality, these emails end up trapped in a development inbox, 
    so that we can then take a look at how they will look later in production.
    That service is called Mailtrap.
    */

    if (process.env.NODE_ENV === 'production') {
      // create transporter for production - Sendgrid
      return nodemailer.createTransport({
        service: 'SendGrid', // nodemail knows 'SendGrid'
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD,
        },
      });
    }

    // for development
    return nodemailer.createTransport({
      //service: 'Gmail',
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // send actual email
  async send(template, subject) {
    // 1) render html for the email based on pug template
    // this will take in the file and then render the pug code into real HTML.
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject,
    });

    // 2) define email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      //  it's better for email delivery rates and also for spam folders.
      // we need a way of converting all the HTML to simple text.
      // So stripping out all of the HTML leaving only the content. Using package html-to-text
      text: htmlToText.fromString(html),
    };

    // 3) create a transport and send email with nodemailer
    await this.newTransport().sendMail(mailOptions);
  }

  // friendly method for sending welcome email
  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Natours Family!'); // 'welcome' is pug template
  }

  // friendly method for sending password reset email
  async sendPasswordReset() {
    await this.send('passwordReset', 'Your password reset token (valid for only 10 mins)'); // 'welcome' is pug template
  }
};
