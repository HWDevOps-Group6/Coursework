const chai = require("chai");
const expect = chai.expect;
const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const Patient = require("../src/models/Patient");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

let MONGO_URI = process.env.MONGODB_URI;
if (MONGO_URI && MONGO_URI.includes("/?")) {
	MONGO_URI = MONGO_URI.replace(/\/(\?|$)/, "/mocha_Test$1");
} else if (MONGO_URI && !MONGO_URI.match(/\/(\w+)\?/)) {
	MONGO_URI = MONGO_URI.replace(/\/?$/, "/mocha_Test");
}

describe("Patient Model (integration)", function () {
	this.timeout(20000);

	before(async () => {
		await mongoose.connect(MONGO_URI);
	});

	after(async () => {
		await mongoose.connection.dropDatabase();
		await mongoose.disconnect();
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
});
