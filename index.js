console.log("jajko");


import express from 'express'

const app = express()

app.get('/', (req, res) => {
  res.send('Hello 11111111111')
})

app.listen(3000)