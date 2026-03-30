const chai = require("chai");
const expect = chai.expect;
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const DiagnosticResult = require("../models/DiagnosticSchema");
const DiagnosticLogic = require("../models/DiagnosticLogic");

let mongoServer;

describe("DiagnosticLogic (integration)", function () {
	this.timeout(30000);

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
		await DiagnosticResult.deleteMany({});
	});

	it("importFromMachine should require patientId", async () => {
		try {
			await DiagnosticLogic.importFromMachine("CT", {});
			throw new Error("Should have thrown");
		} catch (err) {
			expect(err.message).to.equal(
				"patientId is required for importing diagnostics",
			);
		}
	});

	it("importFromMachine should import records with normalized machineType", async () => {
		const results = await DiagnosticLogic.importFromMachine("ct", {
			patientId: "P-2001",
			machineId: "CT-99",
		});

		expect(results.length).to.be.greaterThan(0);
		results.forEach((record) => {
			expect(record.machineType).to.equal("CT");
			expect(record.patientId).to.equal("P-2001");
			expect(record.machineId).to.equal("CT-99");
		});
	});

	it("getAllResults should require patientId", async () => {
		try {
			await DiagnosticLogic.getAllResults({ machineType: "CT" });
			throw new Error("Should have thrown");
		} catch (err) {
			expect(err.message).to.equal(
				"patientId is required to fetch diagnostic results",
			);
		}
	});

	it("getAllResults should filter non-archived records and paginate", async () => {
		await DiagnosticResult.create([
			{
				patientId: "P-3001",
				accessionNo: "ACC3001A",
				machineType: "CT",
				machineId: "CT-01",
				finding: "CT Brain",
				result: "Normal",
				status: "normal",
				isArchived: false,
			},
			{
				patientId: "P-3001",
				accessionNo: "ACC3001B",
				machineType: "CT",
				machineId: "CT-02",
				finding: "CT Chest",
				result: "Critical lesion",
				status: "critical",
				isArchived: false,
			},
			{
				patientId: "P-3001",
				accessionNo: "ACC3001C",
				machineType: "CT",
				machineId: "CT-03",
				finding: "CT Abdomen",
				result: "Archived",
				status: "critical",
				isArchived: true,
			},
		]);

		const page = await DiagnosticLogic.getAllResults({
			patientId: "P-3001",
			machineType: "ct",
			status: "critical",
			page: "1",
			limit: "10",
		});

		expect(page.total).to.equal(1);
		expect(page.count).to.equal(1);
		expect(page.data[0].accessionNo).to.equal("ACC3001B");
	});

	it("verifyResult should set verifiedBy and verifiedAt", async () => {
		const result = await DiagnosticResult.create({
			patientId: "P-4001",
			accessionNo: "ACC4001",
			machineType: "MRI",
			machineId: "MRI-01",
			finding: "MRI Brain",
			result: "Pending review",
			status: "pending",
		});

		const userId = new mongoose.Types.ObjectId().toString();
		const updated = await DiagnosticLogic.verifyResult(result._id.toString(), userId);

		expect(updated.verifiedBy.toString()).to.equal(userId);
		expect(updated.verifiedAt).to.be.instanceOf(Date);
	});

	it("deleteResult should soft delete diagnostic record", async () => {
		const result = await DiagnosticResult.create({
			patientId: "P-5001",
			accessionNo: "ACC5001",
			machineType: "PCR",
			machineId: "PCR-01",
			finding: "PCR SARS",
			result: "Detected",
			status: "critical",
		});

		const deleted = await DiagnosticLogic.deleteResult(result._id.toString());
		expect(deleted.isArchived).to.equal(true);

		const critical = await DiagnosticLogic.getCriticalResults("P-5001");
		expect(critical).to.have.length(0);
	});

	it("getImportStats should return status counters and byMachine map", async () => {
		await DiagnosticResult.create([
			{
				patientId: "P-6001",
				accessionNo: "ACC6001A",
				machineType: "XRAY",
				machineId: "XRAY-01",
				finding: "XRAY Chest",
				result: "Normal",
				status: "normal",
				isArchived: false,
			},
			{
				patientId: "P-6001",
				accessionNo: "ACC6001B",
				machineType: "XRAY",
				machineId: "XRAY-02",
				finding: "XRAY Spine",
				result: "Abnormal",
				status: "abnormal",
				isArchived: false,
			},
			{
				patientId: "P-6001",
				accessionNo: "ACC6001C",
				machineType: "CT",
				machineId: "CT-01",
				finding: "CT Head",
				result: "Critical",
				status: "critical",
				isArchived: false,
			},
			{
				patientId: "P-6001",
				accessionNo: "ACC6001D",
				machineType: "MRI",
				machineId: "MRI-01",
				finding: "MRI Knee",
				result: "Pending",
				status: "pending",
				isArchived: false,
			},
		]);

		const stats = await DiagnosticLogic.getImportStats("P-6001");

		expect(stats.total).to.equal(4);
		expect(stats.critical).to.equal(1);
		expect(stats.pending).to.equal(1);
		expect(stats.abnormal).to.equal(1);
		expect(stats.normal).to.equal(1);
		expect(stats.byMachine).to.include({ XRAY: 2, CT: 1, MRI: 1 });
	});
});