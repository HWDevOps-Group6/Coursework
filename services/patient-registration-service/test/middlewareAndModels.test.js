const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

const Appointment = require("../src/models/Appointment");
const DoctorSchedule = require("../src/models/DoctorSchedule");
const Counter = require("../src/models/Counter");

let mongoServer;

describe("patient-registration middleware + models", function () {
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
		await Appointment.deleteMany({});
		await DoctorSchedule.deleteMany({});
		await Counter.deleteMany({});
	});

	describe("verifyToken middleware", () => {
		it("returns 401 when token is missing", () => {
			const sendErrorStub = sinon.stub().returns("sent");
			const verifyStub = sinon.stub();

			const { verifyToken } = proxyquire("../src/middleware/verifyToken", {
				jsonwebtoken: { verify: verifyStub },
				"../../../../shared/http/responses": { sendError: sendErrorStub },
			});

			const req = { headers: {} };
			const res = {};
			const next = sinon.spy();

			verifyToken(req, res, next);

			expect(sendErrorStub.calledOnce).to.equal(true);
			expect(sendErrorStub.firstCall.args.slice(1, 4)).to.deep.equal([
				401,
				"AUTHENTICATION_REQUIRED",
				"Authentication token is required",
			]);
			expect(next.called).to.equal(false);
		});

		it("attaches user and calls next when token is valid", () => {
			const sendErrorStub = sinon.stub().returns("sent");
			const verifyStub = sinon.stub().returns({
				userId: "u1",
				email: "clerk@example.com",
				role: "clerk",
				department: ["Medicine"],
			});

			const { verifyToken } = proxyquire("../src/middleware/verifyToken", {
				jsonwebtoken: { verify: verifyStub },
				"../../../../shared/http/responses": { sendError: sendErrorStub },
			});

			const req = { headers: { authorization: "Bearer token-value" } };
			const res = {};
			const next = sinon.spy();

			verifyToken(req, res, next);

			expect(next.calledOnce).to.equal(true);
			expect(req.user).to.deep.equal({
				userId: "u1",
				email: "clerk@example.com",
				role: "clerk",
				department: ["Medicine"],
			});
			expect(sendErrorStub.called).to.equal(false);
		});
	});

	describe("authorizeRole middleware", () => {
		it("returns 403 when user role is missing", () => {
			const sendErrorStub = sinon.stub().returns("sent");
			const { authorizeRole } = proxyquire("../src/middleware/authorizeRole", {
				"../../../../shared/http/responses": { sendError: sendErrorStub },
			});

			const middleware = authorizeRole("doctor", "nurse");
			const req = { user: {} };
			const res = {};
			const next = sinon.spy();

			middleware(req, res, next);

			expect(sendErrorStub.calledOnce).to.equal(true);
			expect(sendErrorStub.firstCall.args.slice(1, 4)).to.deep.equal([
				403,
				"ROLE_MISSING",
				"User role is required for this action",
			]);
			expect(next.called).to.equal(false);
		});

		it("returns 403 for unauthorized role", () => {
			const sendErrorStub = sinon.stub().returns("sent");
			const { authorizeRole } = proxyquire("../src/middleware/authorizeRole", {
				"../../../../shared/http/responses": { sendError: sendErrorStub },
			});

			const middleware = authorizeRole("doctor", "nurse");
			const req = { user: { role: "clerk" } };
			const res = {};
			const next = sinon.spy();

			middleware(req, res, next);

			expect(sendErrorStub.calledOnce).to.equal(true);
			expect(sendErrorStub.firstCall.args[2]).to.equal("INSUFFICIENT_ROLE");
			expect(next.called).to.equal(false);
		});

		it("calls next when role is allowed", () => {
			const sendErrorStub = sinon.stub().returns("sent");
			const { authorizeRole } = proxyquire("../src/middleware/authorizeRole", {
				"../../../../shared/http/responses": { sendError: sendErrorStub },
			});

			const middleware = authorizeRole("doctor", "nurse");
			const req = { user: { role: "doctor" } };
			const res = {};
			const next = sinon.spy();

			middleware(req, res, next);

			expect(next.calledOnce).to.equal(true);
			expect(sendErrorStub.called).to.equal(false);
		});
	});

	describe("Appointment model", () => {
		it("applies booked status and manual source defaults", async () => {
			const appointment = new Appointment({
				patientId: "1001",
				doctorId: "doc-1",
				appointmentDate: new Date("2026-04-01T09:00:00.000Z"),
				appointmentEndDate: new Date("2026-04-01T09:30:00.000Z"),
				durationMinutes: 30,
				bookedBy: "clerk-1",
				bookedByRole: "clerk",
			});

			await appointment.validate();

			expect(appointment.status).to.equal("booked");
			expect(appointment.source).to.equal("manual");
		});

		it("fails validation when durationMinutes is outside limits", async () => {
			const appointment = new Appointment({
				patientId: "1002",
				doctorId: "doc-2",
				appointmentDate: new Date("2026-04-01T09:00:00.000Z"),
				appointmentEndDate: new Date("2026-04-01T09:03:00.000Z"),
				durationMinutes: 3,
				bookedBy: "clerk-1",
				bookedByRole: "clerk",
			});

			try {
				await appointment.validate();
				throw new Error("Should fail");
			} catch (err) {
				expect(err.errors).to.have.property("durationMinutes");
			}
		});
	});

	describe("DoctorSchedule model", () => {
		it("validates with correctly formatted slot times", async () => {
			const schedule = new DoctorSchedule({
				doctorId: "doc-10",
				doctorName: "Dr A",
				department: "Medicine",
				weeklyAvailability: [
					{
						dayOfWeek: 1,
						slots: [{ startTime: "09:00", endTime: "09:30" }],
					},
				],
				createdBy: "admin",
				updatedBy: "admin",
				source: "manual",
			});

			await schedule.validate();
			expect(schedule.weeklyAvailability).to.have.length(1);
		});

		it("fails when slot time is not HH:mm", async () => {
			const schedule = new DoctorSchedule({
				doctorId: "doc-11",
				doctorName: "Dr B",
				department: "Medicine",
				weeklyAvailability: [
					{
						dayOfWeek: 2,
						slots: [{ startTime: "9AM", endTime: "09:30" }],
					},
				],
				createdBy: "admin",
				updatedBy: "admin",
				source: "manual",
			});

			try {
				await schedule.validate();
				throw new Error("Should fail");
			} catch (err) {
				expect(err.errors).to.have.property(
					"weeklyAvailability.0.slots.0.startTime",
				);
			}
		});
	});

	describe("Counter model", () => {
		it("applies default value and requires audit fields", async () => {
			const counter = new Counter({
				key: "patientId",
				createdBy: "system",
				updatedBy: "system",
				source: "api",
			});

			await counter.validate();
			expect(counter.value).to.equal(0);
		});

		it("fails when audit source is invalid", async () => {
			const counter = new Counter({
				key: "patientId",
				createdBy: "system",
				updatedBy: "system",
				source: "import",
			});

			try {
				await counter.validate();
				throw new Error("Should fail");
			} catch (err) {
				expect(err.errors).to.have.property("source");
			}
		});
	});
});