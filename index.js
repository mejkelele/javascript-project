import express from "express";
import fs from "fs";

const app = express();
app.use(express.json());

const data = JSON.parse(fs.readFileSync("db.json", "utf-8"));
let tests = data.tests;

app.get("/", (req, res) => {
  res.send("<h1>Serwis internetowy do tworzenia zróżnicowanych testów.</h1>");
});

// wszystkie testy 
app.get("/api/tests", (req, res) => {
  res.json(tests);
});

// test (id)
app.get("/api/tests/:id", (req, res) => {
  const test = tests.find((t) => t.id === parseInt(req.params.id));
  if (!test) return res.status(404).json({ error: "Test nie znaleziony" });
  res.json(test);
});

// dodanie testu  
app.post("/api/tests", (req, res) => {
  const { title, type } = req.body;
  if (!title || !type)
    return res.status(400).json({ error: "Brak wymaganych pól" });

  const newTest = {
    id: tests.length + 1,
    title,
    type,
  };
  tests.push(newTest);

  // zapis do pliku 
  const newData = { tests };
  fs.writeFileSync("db.json", JSON.stringify(newData, null, 2));

  res.status(201).json(newTest);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server działa na http://localhost:${PORT}`));
