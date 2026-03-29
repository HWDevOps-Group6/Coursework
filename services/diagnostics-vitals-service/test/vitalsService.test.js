const chai = require("chai");
const expect = chai.expect;
const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const Vitals = require("../models/VitalsSchema");
const vitalsService = require("../services/vitalsService");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

let MONGO_URI = process.env.MONGODB_URI;
if (MONGO_URI && MONGO_URI.includes("/?")) {
	MONGO_URI = MONGO_URI.replace(/\/(\?|$)/, "/mocha_Test$1");
} else if (MONGO_URI && !MONGO_URI.match(/\/(\w+)\?/)) {
	MONGO_URI = MONGO_URI.replace(/\/?$/, "/mocha_Test");
}

describe("vitalsService (integration)", function () {
	this.timeout(20000);

	before(async () => {
		await mongoose.connect(MONGO_URI);
	});

	after(async () => {
		await mongoose.connection.dropDatabase();
		await mongoose.disconnect();
	});

	beforeEach(async () => {
		await Vitals.deleteMany({});
	});

	it("addVitals should create vitals and return 201", async () => {
		const req = {
			params: { patientId: "p1" },
			body: {
				temperature: 37,
				bp_systolic: 120,
				bp_diastolic: 80,
				pulse: 70,
				source: "device",
				createdBy: "Nurse",
				updatedBy: "Nurse",
			},
			user: { name: "Nurse" },
		};
		const res = {
			status: function (code) {
				this.statusCode = code;
				return this;
			},
			json: function (data) {
				this.data = data;
				return this;
			},
		};
		await vitalsService.addVitals(req, res);
		expect(res.statusCode).to.equal(201);
		expect(res.data).to.have.property("patientId", "p1");
	});

	it("getVitals should return vitals array", async () => {
		await Vitals.create({
			patientId: "p1",
			temperature: 37,
			bp_systolic: 120,
			bp_diastolic: 80,
			pulse: 70,
			source: "device",
			createdBy: "Nurse",
			updatedBy: "Nurse",
		});
		const req = { params: { patientId: "p1" } };
		const res = {
			json: function (data) {
				this.data = data;
				return this;
			},
		};
		await vitalsService.getVitals(req, res);
		expect(res.data).to.be.an("array");
		expect(res.data[0]).to.have.property("patientId", "p1");
	});
});
