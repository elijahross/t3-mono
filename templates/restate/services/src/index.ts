import * as restate from "@restatedev/restate-sdk";
import { EmbeddingService } from "./embedding";
import { ExtractionService } from "./extraction";
import { AWSS3Service } from "./aws-s3";
import { AWSLambdaService } from "./aws-lambda";

// Export services for use in workflows
export { EmbeddingService, ExtractionService, AWSS3Service, AWSLambdaService };

// Start the server if run directly
if (require.main === module) {
  const port = parseInt(process.env.PORT || "9082");

  restate
    .endpoint()
    .bind(EmbeddingService)
    .bind(ExtractionService)
    .bind(AWSS3Service)
    .bind(AWSLambdaService)
    .listen(port)
    .then(() => {
      console.log(`Restate Services listening on port ${port}`);
      console.log("\nAvailable services:");
      console.log("  - EmbeddingService (Ollama embeddings)");
      console.log("  - ExtractionService (Docling document extraction)");
      console.log("  - AWSS3Service (AWS S3 operations)");
      console.log("  - AWSLambdaService (AWS Lambda invocations)");
      console.log(`\nRegister with Restate:`);
      console.log(`  curl -X POST http://localhost:9070/deployments \\`);
      console.log(`    -H 'content-type: application/json' \\`);
      console.log(`    -d '{"uri": "http://localhost:${port}"}'`);
    });
}
