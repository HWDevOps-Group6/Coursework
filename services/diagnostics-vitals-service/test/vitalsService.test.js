const chai = require("chai");
const expect = chai.expect;
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const sinon = require("sinon");
const Vitals = require("../models/VitalsSchema");
const vitalsService = require("../services/vitalsService");

let mongoServer;

describe("vitalsService (integration)", function () {
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

	it("addVitals should apply default source and createdBy", async () => {
		const req = {
			params: { patientId: "p2" },
			body: {
				temperature: 36.8,
				bp_systolic: 118,
				bp_diastolic: 78,
				pulse: 72,
			},
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
		expect(res.data).to.include({
			patientId: "p2",
			source: "device",
			createdBy: "IoT Device",
			updatedBy: "IoT Device",
		});
	});

	it("addVitals should return 400 on validation failure", async () => {
		const req = {
			params: { patientId: "p3" },
			body: {
				temperature: 37,
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

		expect(res.statusCode).to.equal(400);
		expect(res.data).to.have.property("error");
	});

	it("getVitals should return 500 when query fails", async () => {
		const req = { params: { patientId: "p1" } };
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

		const findStub = sinon.stub(Vitals, "find").throws(new Error("db fail"));

		await vitalsService.getVitals(req, res);

		expect(res.statusCode).to.equal(500);
		expect(res.data).to.deep.equal({ error: "db fail" });

		findStub.restore();
	});
});
