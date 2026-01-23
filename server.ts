import { Express } from "express";

export function startServer(app: Express) {
  const PORT = process.env.PORT || 8080;

  //server listening
    app.listen(PORT, () => {
        console.log("Starting the listing process.");
        console.log(
            `${process.env.NODE_ENV} Server is running on port: http://localhost:${PORT}`
        );
    });
}
