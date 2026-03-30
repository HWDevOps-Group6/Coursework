const chai = require("chai");
const expect = chai.expect;
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const Patient = require("../src/models/Patient");

let mongoServer;

describe("Patient Model (integration)", function () {
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

	it("should be invalid if required fields are missing", async () => {
		const patient = new Patient();
		try {
			await patient.validate();
			throw new Error("Should have failed validation");
		} catch (err) {
			expect(err.errors).to.have.property("id");
			expect(err.errors).to.have.property("emiratesIdHash");
			expect(err.errors).to.have.property("firstName");
			expect(err.errors).to.have.property("lastName");
			expect(err.errors).to.have.property("dateOfBirth");
			expect(err.errors).to.have.property("gender");
			expect(err.errors).to.have.property("entryRoute");
			expect(err.errors).to.have.property("servicePoint");
			expect(err.errors).to.have.property("registeredBy");
			expect(err.errors).to.have.property("registeredByRole");
		}
	});

	it("should save with all required fields", async () => {
		const patient = new Patient({
			id: "P001",
			emiratesIdHash: "test_hash",
			firstName: "John",
			lastName: "Doe",
			dateOfBirth: "1990-01-01",
			gender: "male",
			entryRoute: "OPD",
			servicePoint: "General",
			registeredBy: "admin",
			registeredByRole: "admin",
			updatedBy: "Clerk_test",
			createdBy: "Clerk_test",
			source: "manual",
		});
		await patient.validate();
		await patient.save();
		const found = await Patient.findOne({ id: "P001" });
		expect(found).to.exist;
		expect(found.firstName).to.equal("John");
	});

	it("should apply default arrays when optional lists are omitted", async () => {
		const patient = new Patient({
			id: "P002",
			emiratesIdHash: "hash_2",
			firstName: "Jane",
			lastName: "Smith",
			dateOfBirth: "1992-02-02",
			gender: "female",
			entryRoute: "OPD",
			servicePoint: "General",
			registeredBy: "admin",
			registeredByRole: "admin",
			updatedBy: "Clerk_test",
			createdBy: "Clerk_test",
			source: "manual",
		});

		await patient.save();

		expect(patient.knownDiseases).to.deep.equal([]);
		expect(patient.complaints).to.deep.equal([]);
		expect(patient.visitHistory).to.deep.equal([]);
		expect(patient.prescriptions).to.deep.equal([]);
	});

	it("should fail when entryRoute is invalid", async () => {
		const patient = new Patient({
			id: "P003",
			emiratesIdHash: "hash_3",
			firstName: "Invalid",
			lastName: "Route",
			dateOfBirth: "1993-03-03",
			gender: "female",
			entryRoute: "ER",
			servicePoint: "General",
			registeredBy: "admin",
			registeredByRole: "admin",
			updatedBy: "Clerk_test",
			createdBy: "Clerk_test",
			source: "manual",
		});

		try {
			await patient.validate();
			throw new Error("Should have failed validation");
		} catch (err) {
			expect(err.errors).to.have.property("entryRoute");
		}
	});

	it("should fail when audit source is invalid", async () => {
		const patient = new Patient({
			id: "P004",
			emiratesIdHash: "hash_4",
			firstName: "Invalid",
			lastName: "Source",
			dateOfBirth: "1994-04-04",
			gender: "female",
			entryRoute: "OPD",
			servicePoint: "General",
			registeredBy: "admin",
			registeredByRole: "admin",
			updatedBy: "Clerk_test",
			createdBy: "Clerk_test",
			source: "imported",
		});

		try {
			await patient.validate();
			throw new Error("Should have failed validation");
		} catch (err) {
			expect(err.errors).to.have.property("source");
		}
	});
});
