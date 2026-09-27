import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // ValidationPipe TOÀN CỤC — đây là chỗ các decorator @IsUUID(), @IsNumber()...
  // trong DTO (create-contract.dto.ts) thực sự được "kích hoạt". Không có
  // dòng này thì DTO chỉ là khai báo suông, NestJS sẽ KHÔNG tự kiểm tra gì cả.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // tự động loại bỏ field lạ không khai báo trong DTO
      forbidNonWhitelisted: true, // field lạ -> trả lỗi 400 luôn (thay vì âm thầm bỏ qua)
      transform: true, // tự chuyển kiểu (vd query string "5" -> number 5)
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Management Service API')
    .setDescription('CRUD nghiệp vụ: Contract, Shipment, Container, YardVisit, Inspection, Movement, Event, Invoice, Payment')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Management Service is running on port ${port}`);
}
bootstrap();
