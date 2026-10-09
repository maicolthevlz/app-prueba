const token = "eyJhbGciOiJSUzI1NiIsImtpZCI6IlE1dnZEckFhM2I2VFNUSkloUThyYkE5UEdQVklDTGxFQ0pCSEc0aXpZSmciLCJ0eXAiOiJKV1QifQ.eyJvaWQiOiJyZWFjdC11c2VyLTAwMSIsInN1YiI6InJlYWN0LXVzZXItMDAxIiwiZW1haWwiOiJ1c3VhcmlvLnBydWViYUBlc3NhLmNvbS5jbyIsImRvY3VtZW50IjoiMTM4NDQ5MjgiLCJnaXZlbl9uYW1lIjoiVXN1YXJpbyIsImZhbWlseV9uYW1lIjoiUHJ1ZWJhIiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo1MDUwIiwiYXVkIjoiZG5uLXRlc3QtYXBpIiwiaWF0IjoxNzkxMzE4NTM2LCJleHAiOjE3OTEzMjAzMzZ9.sak_fMoVrtN__wdh9jIv2GM9cFkhB884bheXJevutewl_6cUZ3IDGr9f1MGJAMEMfvpco8A1M6ix6k8ZyDTRr0Ffo4yWMuZZ8iwWKk9_iIldDbaGP3eU60fTNrhfgX8lfJ3jrQoFvin_fNiEUj7y4rhZWKcgpEQvLSj8j2OztREOPsY44VSY2_f2O4qisaY4PXz2i9MekI8qb8ziofLB9OF3zEK6mzXArbfD_8IjtXtsBzrn4edP-QZDd_Y0Bkib8Xtqoi2bO4tLRMcoRuIE0qwYpMc3M-H0dpHAW_lyZ56WS00ZiYoqE4NPCXnclkNuwD-AoLzparnctLiaeKgHAQ";
const cuenta = "123456";
const proceso = "123456";
const paso = "1";

console.log("JWT length:", token.length);
console.log("JWT inicio:", token.slice(0, 10));
console.log("JWT fin:", token.slice(-10));

const url = new URL(
  "https://upgrade.essa.com.co/site/serviciosdigitales/solicitud-del-servicio-creg001-app"
);

url.searchParams.set("token", token);
url.searchParams.set("cuenta", cuenta);
url.searchParams.set("proceso", proceso);
url.searchParams.set("paso", paso);

console.log(url.toString());