import app from "./app";

console.log("1. app imported");

const PORT = 3000;

console.log("2. starting server");

app.listen(PORT, () => {
  console.log(`server is running at PORT ${PORT}`);
});

console.log("3. listen called");
