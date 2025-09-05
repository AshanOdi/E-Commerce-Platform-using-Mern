import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.json({
    message: "this is response of get request",
  });
});

app.delete("/", (req, res) => {
  res.json({
    message: "this is response of delete request",
  });
});

app.post("/", (req, res) => {
  res.json({
    message: "this is response of post request",
  });
});

app.put("/", (req, res) => {
  res.json({
    message: "this is response of put request",
  });
});

app.listen(5000, () => {
  console.log("This server is running on Port 5000");
});
