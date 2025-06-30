-- CreateTable
CREATE TABLE "hr_job_openings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_job_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_job_opening_descriptions" (
    "id" TEXT NOT NULL,
    "job_opening_id" TEXT NOT NULL,
    "html_content" TEXT NOT NULL,

    CONSTRAINT "hr_job_opening_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_job_application_forms" (
    "id" TEXT NOT NULL,
    "job_opening_id" TEXT,

    CONSTRAINT "hr_job_application_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_application_fields" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "hr_application_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_job_applications" (
    "id" TEXT NOT NULL,
    "job_opening_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes_internal" TEXT,

    CONSTRAINT "hr_job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_application_answers" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "field_label" TEXT NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "hr_application_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_interviews" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "proposed_date" TIMESTAMP(3) NOT NULL,
    "confirmed_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "hr_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_hiring_proposals" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "hr_hiring_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hr_job_opening_descriptions_job_opening_id_key" ON "hr_job_opening_descriptions"("job_opening_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_job_application_forms_job_opening_id_key" ON "hr_job_application_forms"("job_opening_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_interviews_application_id_key" ON "hr_interviews"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_hiring_proposals_application_id_key" ON "hr_hiring_proposals"("application_id");

-- AddForeignKey
ALTER TABLE "hr_job_opening_descriptions" ADD CONSTRAINT "hr_job_opening_descriptions_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "hr_job_openings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_job_application_forms" ADD CONSTRAINT "hr_job_application_forms_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "hr_job_openings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_application_fields" ADD CONSTRAINT "hr_application_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "hr_job_application_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_job_applications" ADD CONSTRAINT "hr_job_applications_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "hr_job_openings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_application_answers" ADD CONSTRAINT "hr_application_answers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "hr_job_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_interviews" ADD CONSTRAINT "hr_interviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "hr_job_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_hiring_proposals" ADD CONSTRAINT "hr_hiring_proposals_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "hr_job_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
