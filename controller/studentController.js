import Student from "../models/student.js";

export function saveStudent(req, res) {
  const student = new Student({
    name: req.body.name,
    age: req.body.age,
    stream: req.body.stream,
    email: req.body.email,
  });

  student
    .save()
    .then(() => {
      res.json({
        message: "Successfully Added Student",
      });
    })
    .catch(() => {
      res.json({
        message: "Failed to Add Student",
      });
    });
}

export function getStudent(req, res) {
  Student.find().then((data) => {
    res.json(data);
  });
}
