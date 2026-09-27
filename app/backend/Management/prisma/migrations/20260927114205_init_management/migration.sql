-- CreateEnum
CREATE TYPE "management"."ContractStatus" AS ENUM ('Draft', 'Active', 'Expired', 'Terminated');

-- CreateEnum
CREATE TYPE "management"."ContainerStatus" AS ENUM ('AVAILABLE', 'MAINTENANCE', 'DAMAGED');

-- CreateEnum
CREATE TYPE "management"."ShipmentStatus" AS ENUM ('Planned', 'In Transit', 'Arrived', 'Completed');

-- CreateEnum
CREATE TYPE "management"."YardVisitStatus" AS ENUM ('PLANNED', 'ARRIVED', 'IN_YARD', 'STAGING', 'DEPARTED', 'CLOSED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "management"."InspectionType" AS ENUM ('Gate-in', 'Gate-out', 'Ad-hoc');

-- CreateEnum
CREATE TYPE "management"."InspectionResult" AS ENUM ('Pass', 'Fail');

-- CreateEnum
CREATE TYPE "management"."InspectionFailReason" AS ENUM ('seal_mismatch', 'physical_damage_minor', 'physical_damage_severe', 'other');

-- CreateEnum
CREATE TYPE "management"."MovementType" AS ENUM ('Gate-in', 'Relocation', 'Rehandle', 'Gate-out');

-- CreateEnum
CREATE TYPE "management"."YardEventType" AS ENUM ('Customs Hold', 'Rejected', 'Dispute', 'Damage During Movement', 'Owner Request');

-- CreateEnum
CREATE TYPE "management"."ResolutionStatus" AS ENUM ('Open', 'Resolved');

-- CreateEnum
CREATE TYPE "management"."InvoiceType" AS ENUM ('Deposit', 'Storage Fee', 'Final Settlement', 'Other');

-- CreateEnum
CREATE TYPE "management"."PaymentStatus" AS ENUM ('Unpaid', 'Partial', 'Paid');

-- CreateEnum
CREATE TYPE "management"."PaymentMethod" AS ENUM ('Bank Transfer', 'Cash', 'Card');

-- CreateTable
CREATE TABLE "management"."contract" (
    "contract_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "effective_date" DATE NOT NULL,
    "expiry_date" DATE NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "free_time_days" INTEGER NOT NULL,
    "surcharge_rate" DECIMAL(8,4) NOT NULL,
    "payment_terms" TEXT,
    "status" "management"."ContractStatus" NOT NULL DEFAULT 'Draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("contract_id")
);

-- CreateTable
CREATE TABLE "management"."container" (
    "container_id" UUID NOT NULL,
    "container_code" TEXT NOT NULL,
    "container_type" TEXT NOT NULL,
    "size_type_code" TEXT NOT NULL,
    "tare_weight" DECIMAL(12,3),
    "max_gross_weight" DECIMAL(12,3),
    "max_payload" DECIMAL(12,3),
    "capacity" DECIMAL(12,3),
    "status" "management"."ContainerStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "container_pkey" PRIMARY KEY ("container_id")
);

-- CreateTable
CREATE TABLE "management"."shipment" (
    "shipment_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "shipper" TEXT NOT NULL,
    "consignee" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "origin" TEXT,
    "loading_port" TEXT,
    "discharge_port" TEXT,
    "vessel" TEXT,
    "voyage" TEXT,
    "status" "management"."ShipmentStatus" NOT NULL DEFAULT 'Planned',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("shipment_id")
);

-- CreateTable
CREATE TABLE "management"."shipment_container" (
    "shipment_container_id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "container_id" UUID NOT NULL,
    "seal_number" TEXT NOT NULL,
    "seal_type" TEXT NOT NULL,
    "gross_weight_actual" DECIMAL(12,3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_container_pkey" PRIMARY KEY ("shipment_container_id")
);

-- CreateTable
CREATE TABLE "management"."cargo" (
    "cargo_id" UUID NOT NULL,
    "shipment_container_id" UUID NOT NULL,
    "cargo_type" TEXT NOT NULL,
    "weight" DECIMAL(12,3) NOT NULL,
    "volume" DECIMAL(12,3),
    "is_hazardous" BOOLEAN NOT NULL DEFAULT false,
    "temperature_min" DECIMAL(6,2),
    "temperature_max" DECIMAL(6,2),
    "humidity_min" DECIMAL(5,2),
    "humidity_max" DECIMAL(5,2),
    "special_handling" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargo_pkey" PRIMARY KEY ("cargo_id")
);

-- CreateTable
CREATE TABLE "management"."yard_visit" (
    "yard_visit_id" UUID NOT NULL,
    "shipment_container_id" UUID NOT NULL,
    "current_slot_id" UUID,
    "eta" TIMESTAMP(3) NOT NULL,
    "etd" TIMESTAMP(3),
    "ata" TIMESTAMP(3),
    "atd" TIMESTAMP(3),
    "free_time_days_snapshot" INTEGER NOT NULL,
    "status" "management"."YardVisitStatus" NOT NULL DEFAULT 'PLANNED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yard_visit_pkey" PRIMARY KEY ("yard_visit_id")
);

-- CreateTable
CREATE TABLE "management"."inspection" (
    "inspection_id" UUID NOT NULL,
    "yard_visit_id" UUID NOT NULL,
    "inspection_type" "management"."InspectionType" NOT NULL,
    "seal_check" BOOLEAN NOT NULL,
    "result" "management"."InspectionResult" NOT NULL,
    "fail_reason" "management"."InspectionFailReason",
    "damage_notes" TEXT,
    "inspected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspected_by" UUID,

    CONSTRAINT "inspection_pkey" PRIMARY KEY ("inspection_id")
);

-- CreateTable
CREATE TABLE "management"."movement" (
    "movement_id" UUID NOT NULL,
    "yard_visit_id" UUID NOT NULL,
    "movement_type" "management"."MovementType" NOT NULL,
    "from_slot_id" UUID,
    "to_slot_id" UUID,
    "reason" TEXT,
    "moved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operator_id" UUID,

    CONSTRAINT "movement_pkey" PRIMARY KEY ("movement_id")
);

-- CreateTable
CREATE TABLE "management"."event" (
    "event_id" UUID NOT NULL,
    "yard_visit_id" UUID NOT NULL,
    "event_type" "management"."YardEventType" NOT NULL,
    "description" TEXT,
    "requested_by" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolution_status" "management"."ResolutionStatus" NOT NULL DEFAULT 'Open',

    CONSTRAINT "event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "management"."invoice" (
    "invoice_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "yard_visit_id" UUID,
    "invoice_type" "management"."InvoiceType" NOT NULL,
    "actual_storage_duration" INTEGER,
    "overdue_days" INTEGER,
    "base_storage_fee" DECIMAL(18,2),
    "surcharge_amount" DECIMAL(18,2),
    "total_amount" DECIMAL(18,2) NOT NULL,
    "payment_status" "management"."PaymentStatus" NOT NULL DEFAULT 'Unpaid',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("invoice_id")
);

-- CreateTable
CREATE TABLE "management"."payment" (
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount_paid" DECIMAL(18,2) NOT NULL,
    "payment_method" "management"."PaymentMethod" NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("payment_id")
);

-- CreateIndex
CREATE INDEX "contract_customer_id_idx" ON "management"."contract"("customer_id");

-- CreateIndex
CREATE INDEX "contract_status_expiry_date_idx" ON "management"."contract"("status", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "container_container_code_key" ON "management"."container"("container_code");

-- CreateIndex
CREATE INDEX "container_status_idx" ON "management"."container"("status");

-- CreateIndex
CREATE INDEX "shipment_contract_id_idx" ON "management"."shipment"("contract_id");

-- CreateIndex
CREATE INDEX "shipment_status_idx" ON "management"."shipment"("status");

-- CreateIndex
CREATE INDEX "shipment_container_shipment_id_idx" ON "management"."shipment_container"("shipment_id");

-- CreateIndex
CREATE INDEX "shipment_container_container_id_idx" ON "management"."shipment_container"("container_id");

-- CreateIndex
CREATE INDEX "cargo_shipment_container_id_idx" ON "management"."cargo"("shipment_container_id");

-- CreateIndex
CREATE INDEX "yard_visit_shipment_container_id_idx" ON "management"."yard_visit"("shipment_container_id");

-- CreateIndex
CREATE INDEX "yard_visit_status_eta_idx" ON "management"."yard_visit"("status", "eta");

-- CreateIndex
CREATE INDEX "yard_visit_current_slot_id_idx" ON "management"."yard_visit"("current_slot_id");

-- CreateIndex
CREATE INDEX "inspection_yard_visit_id_inspected_at_idx" ON "management"."inspection"("yard_visit_id", "inspected_at");

-- CreateIndex
CREATE INDEX "movement_yard_visit_id_moved_at_idx" ON "management"."movement"("yard_visit_id", "moved_at");

-- CreateIndex
CREATE INDEX "movement_from_slot_id_idx" ON "management"."movement"("from_slot_id");

-- CreateIndex
CREATE INDEX "movement_to_slot_id_idx" ON "management"."movement"("to_slot_id");

-- CreateIndex
CREATE INDEX "event_yard_visit_id_occurred_at_idx" ON "management"."event"("yard_visit_id", "occurred_at");

-- CreateIndex
CREATE INDEX "event_resolution_status_idx" ON "management"."event"("resolution_status");

-- CreateIndex
CREATE INDEX "invoice_contract_id_issued_at_idx" ON "management"."invoice"("contract_id", "issued_at");

-- CreateIndex
CREATE INDEX "invoice_yard_visit_id_idx" ON "management"."invoice"("yard_visit_id");

-- CreateIndex
CREATE INDEX "invoice_payment_status_idx" ON "management"."invoice"("payment_status");

-- CreateIndex
CREATE INDEX "payment_invoice_id_payment_date_idx" ON "management"."payment"("invoice_id", "payment_date");

-- AddForeignKey
ALTER TABLE "management"."shipment" ADD CONSTRAINT "shipment_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "management"."contract"("contract_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management"."shipment_container" ADD CONSTRAINT "shipment_container_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "management"."shipment"("shipment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management"."shipment_container" ADD CONSTRAINT "shipment_container_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "management"."container"("container_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management"."cargo" ADD CONSTRAINT "cargo_shipment_container_id_fkey" FOREIGN KEY ("shipment_container_id") REFERENCES "management"."shipment_container"("shipment_container_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management"."yard_visit" ADD CONSTRAINT "yard_visit_shipment_container_id_fkey" FOREIGN KEY ("shipment_container_id") REFERENCES "management"."shipment_container"("shipment_container_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management"."inspection" ADD CONSTRAINT "inspection_yard_visit_id_fkey" FOREIGN KEY ("yard_visit_id") REFERENCES "management"."yard_visit"("yard_visit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management"."movement" ADD CONSTRAINT "movement_yard_visit_id_fkey" FOREIGN KEY ("yard_visit_id") REFERENCES "management"."yard_visit"("yard_visit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management"."event" ADD CONSTRAINT "event_yard_visit_id_fkey" FOREIGN KEY ("yard_visit_id") REFERENCES "management"."yard_visit"("yard_visit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management"."invoice" ADD CONSTRAINT "invoice_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "management"."contract"("contract_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management"."invoice" ADD CONSTRAINT "invoice_yard_visit_id_fkey" FOREIGN KEY ("yard_visit_id") REFERENCES "management"."yard_visit"("yard_visit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management"."payment" ADD CONSTRAINT "payment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "management"."invoice"("invoice_id") ON DELETE RESTRICT ON UPDATE CASCADE;
