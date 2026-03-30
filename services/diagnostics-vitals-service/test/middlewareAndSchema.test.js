const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const DiagnosticResult = require("../models/DiagnosticSchema");
const Vitals = require("../models/VitalsSchema");

let mongoServer;

describe("diagnostics middleware + schema", function () {
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
		await DiagnosticResult.deleteMany({});
		await Vitals.deleteMany({});
	});

	describe("verifyToken middleware", () => {
		it("returns 401 when token is missing", () => {
			const sendErrorStub = sinon.stub().returns("sent");
			const verifyStub = sinon.stub();

			const { verifyToken } = proxyquire("../middleware/verifyToken", {
				jsonwebtoken: { verify: verifyStub },
				"../../../shared/http/responses": { sendError: sendErrorStub },
			});

			const req = { headers: {} };
			const res = {};
			const next = sinon.spy();

			verifyToken(req, res, next);

			expect(sendErrorStub.calledOnce).to.equal(true);
			expect(next.called).to.equal(false);
		});

		it("returns 401 with expired token message", () => {
			const sendErrorStub = sinon.stub().returns("sent");
			const verifyStub = sinon.stub().throws({ name: "TokenExpiredError" });

			const { verifyToken } = proxyquire("../middleware/verifyToken", {
				jsonwebtoken: { verify: verifyStub },
				"../../../shared/http/responses": { sendError: sendErrorStub },
			});

			const req = { headers: { authorization: "Bearer expired" } };
			const res = {};
			const next = sinon.spy();

			verifyToken(req, res, next);

			expect(sendErrorStub.calledOnce).to.equal(true);
			expect(sendErrorStub.firstCall.args[3]).to.equal("Token has expired");
			expect(next.called).to.equal(false);
		});
	});

	describe("authorizeRole middleware", () => {
		it("blocks missing role and unauthorized role", () => {
			const sendErrorStub = sinon.stub().returns("sent");
			const { authorizeRole } = proxyquire("../middleware/authorizeRole", {
				"../../../shared/http/responses": { sendError: sendErrorStub },
			});

			const middleware = authorizeRole("doctor", "clinician");

			const reqMissingRole = { user: {} };
			middleware(reqMissingRole, {}, sinon.spy());
			expect(sendErrorStub.calledOnce).to.equal(true);

			const reqWrongRole = { user: { role: "nurse" } };
			middleware(reqWrongRole, {}, sinon.spy());
			expect(sendErrorStub.calledTwice).to.equal(true);
		});
	});

	describe("DiagnosticResult schema", () => {
		it("sets isCritical virtual based on status", async () => {
			const critical = await DiagnosticResult.create({
				patientId: "P-9001",
				accessionNo: "ACC9001A",
				machineType: "MRI",
				machineId: "MRI-01",
				finding: "MRI",
				result: "Critical finding",
				status: "critical",
			});

			const normal = await DiagnosticResult.create({
				patientId: "P-9001",
				accessionNo: "ACC9001B",
				machineType: "CT",
				machineId: "CT-01",
				finding: "CT",
				result: "Normal finding",
				status: "normal",
			});

			expect(critical.isCritical).to.equal(true);
			expect(normal.isCritical).to.equal(false);
		});
	});

	describe("Vitals schema", () => {
		it("requires vital fields and valid audit source", async () => {
			const badVitals = new Vitals({ patientId: "P-9100", source: "import" });

			try {
				await badVitals.validate();
				throw new Error("Should fail");
			} catch (err) {
				expect(err.errors).to.have.property("temperature");
				expect(err.errors).to.have.property("bp_systolic");
				expect(err.errors).to.have.property("bp_diastolic");
				expect(err.errors).to.have.property("pulse");
				expect(err.errors).to.have.property("source");
			}
		});
	});
});