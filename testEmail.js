async function emailTest() {
  const verificationUrl = 'https://kanway.ru/verify-email?token=1234567890'

  const inputBody = {
    message: {
      recipients: [
        {
          email: 'senior.alexander2016@yandex.ru',
        },
      ],
      body: {
        html: `<p>Подтвердите почту по ссылке: <a href="${verificationUrl}">${verificationUrl}</a></p>`,
        plaintext: `Подтвердите почту по ссылке: ${verificationUrl}`,
      },
      subject: 'Подтверждение почты',
      from_email: 'noreply@kanway.ru',
      from_name: 'Kanway',
      track_links: 0,
      track_read: 0,
    },
  }

  const response = await fetch('https://go2.unisender.ru/ru/transactional/api/v1/email/send.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-KEY': process.env.UNISENDER_API_KEY || '',
    },
    body: JSON.stringify(inputBody),
  })

  const responseBody = await response.json()
  console.log(responseBody)
}

emailTest()
