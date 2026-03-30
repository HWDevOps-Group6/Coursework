const chai = require("chai");
const expect = chai.expect;
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const Patient = require("../src/models/Patient");

let mongoServer;

describe("Patient subdocuments + uniqueness (integration)", function () {
	this.timeout(20000);

	before(async () => {
		mongoServer = await MongoMemoryServer.create();
		await mongoose.connect(mongoServer.getUri(), {
			dbName: "mocha_Test",
		});
	});

	after(async () => {
		if (mongoose.connection.readyState !== 0) {
			await mongoose.connection.dropDatabase();
			await mongoose.disconnect();
		}

		if (mongoServer) {
			await mongoServer.stop();
		}
	});

	beforeEach(async () => {
		await Patient.deleteMany({});
	});

	const basePatient = {
		id: "P100",
		emiratesIdHash: "hash-p100",
		firstName: "Base",
		lastName: "Patient",
		dateOfBirth: "1990-01-01",
		gender: "male",
		entryRoute: "OPD",
		servicePoint: "General",
		registeredBy: "clerk-1",
		registeredByRole: "clerk",
		createdBy: "clerk-1",
		updatedBy: "clerk-1",
		source: "manual",
	};

	it("keeps emiratesIdHash immutable after creation", async () => {
		const patient = await Patient.create(basePatient);

		patient.emiratesIdHash = "hash-updated";
		await patient.save();

		const reloaded = await Patient.findOne({ id: basePatient.id })
			.select("+emiratesIdHash")
			.lean();

		expect(reloaded.emiratesIdHash).to.equal(basePatient.emiratesIdHash);
	});

	it("validates required fields in nursing notes subdocument", async () => {
		const patient = new Patient({
			...basePatient,
			id: "P102",
			emiratesIdHash: "hash-p102",
			nursingNotes: [
				{
					treatmentDetails: "IV fluids",
					intakeOutput: "Adequate",
					recordedAt: new Date(),
					createdBy: "nurse-1",
					updatedBy: "nurse-1",
					source: "manual",
					recordedBy: "nurse-1",
				},
			],
		});

		try {
			await patient.validate();
			throw new Error("Should fail");
		} catch (err) {
			expect(err.errors).to.have.property("nursingNotes.0.recordedByRole");
		}
	});

	it("validates enums in embedded diagnostic results", async () => {
		const patient = new Patient({
			...basePatient,
			id: "P103",
			emiratesIdHash: "hash-p103",
			diagnosticResults: [
				{
					patient: new mongoose.Types.ObjectId(),
					patientId: "P103",
					accessionNo: "ACCP103",
					machineType: "INVALID_MACHINE",
					machineId: "M-1",
					finding: "Test",
					result: "Test",
					status: "normal",
				},
			],
		});

		try {
			await patient.validate();
			throw new Error("Should fail");
		} catch (err) {
			expect(err.errors).to.have.property("diagnosticResults.0.machineType");
		}
	});
});