const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

describe("auth middleware + validation + jwt", () => {
	describe("authenticate middleware", () => {
		let verifyTokenStub;
		let extractTokenFromHeaderStub;
		let findByIdStub;
		let sendErrorStub;
		let authenticate;

		beforeEach(() => {
			verifyTokenStub = sinon.stub();
			extractTokenFromHeaderStub = sinon.stub();
			findByIdStub = sinon.stub();
			sendErrorStub = sinon.stub().returns("error-sent");

			({ authenticate } = proxyquire("../src/middleware/auth", {
				"../utils/jwt": {
					verifyToken: verifyTokenStub,
					extractTokenFromHeader: extractTokenFromHeaderStub,
				},
				"../models/User": {
					findById: findByIdStub,
				},
				"../../../../shared/http/responses": {
					sendError: sendErrorStub,
				},
			}));
		});

		it("returns 401 when authorization token is missing", async () => {
			extractTokenFromHeaderStub.returns(null);

			const req = { headers: {} };
			const res = {};
			const next = sinon.spy();

			await authenticate(req, res, next);

			expect(sendErrorStub.calledOnce).to.equal(true);
			expect(sendErrorStub.firstCall.args.slice(1, 4)).to.deep.equal([
				401,
				"AUTHENTICATION_REQUIRED",
				"Authentication token is required",
			]);
			expect(next.called).to.equal(false);
		});

		it("returns 401 for invalid token", async () => {
			extractTokenFromHeaderStub.returns("bad-token");
			verifyTokenStub.throws(new Error("Invalid token"));

			const req = { headers: { authorization: "Bearer bad-token" } };
			const res = {};
			const next = sinon.spy();

			await authenticate(req, res, next);

			expect(sendErrorStub.calledOnce).to.equal(true);
			expect(sendErrorStub.firstCall.args.slice(1, 4)).to.deep.equal([
				401,
				"INVALID_TOKEN",
				"Invalid token",
			]);
			expect(next.called).to.equal(false);
		});

		it("returns 401 when user is not found", async () => {
			extractTokenFromHeaderStub.returns("ok-token");
			verifyTokenStub.returns({ userId: "u1" });
			findByIdStub.resolves(null);

			const req = { headers: { authorization: "Bearer ok-token" } };
			const res = {};
			const next = sinon.spy();

			await authenticate(req, res, next);

			expect(sendErrorStub.calledOnce).to.equal(true);
			expect(sendErrorStub.firstCall.args.slice(1, 4)).to.deep.equal([
				401,
				"USER_NOT_FOUND",
				"User associated with token not found",
			]);
			expect(next.called).to.equal(false);
		});

		it("returns 401 when account is deactivated", async () => {
			extractTokenFromHeaderStub.returns("ok-token");
			verifyTokenStub.returns({ userId: "u2" });
			findByIdStub.resolves({ isActive: false });

			const req = { headers: { authorization: "Bearer ok-token" } };
			const res = {};
			const next = sinon.spy();

			await authenticate(req, res, next);

			expect(sendErrorStub.calledOnce).to.equal(true);
			expect(sendErrorStub.firstCall.args.slice(1, 4)).to.deep.equal([
				401,
				"ACCOUNT_DEACTIVATED",
				"User account is deactivated",
			]);
			expect(next.called).to.equal(false);
		});

		it("attaches normalized user and calls next on success", async () => {
			const userId = new mongoose.Types.ObjectId();
			extractTokenFromHeaderStub.returns("ok-token");
			verifyTokenStub.returns({ userId: userId.toString() });
			findByIdStub.resolves({
				_id: userId,
				email: "doctor@example.com",
				role: "doctor",
				department: ["Medicine"],
				firstName: "Doc",
				lastName: "Tor",
				isActive: true,
			});

			const req = { headers: { authorization: "Bearer ok-token" } };
			const res = {};
			const next = sinon.spy();

			await authenticate(req, res, next);

			expect(next.calledOnce).to.equal(true);
			expect(req.user).to.deep.equal({
				userId: userId.toString(),
				email: "doctor@example.com",
				role: "doctor",
				department: ["Medicine"],
				firstName: "Doc",
				lastName: "Tor",
			});
			expect(sendErrorStub.called).to.equal(false);
		});
	});

	describe("validate middleware", () => {
		let sendErrorStub;
		let validate;
		let schemas;

		beforeEach(() => {
			sendErrorStub = sinon.stub().returns("validation-error");
			({ validate, schemas } = proxyquire("../src/middleware/validation", {
				"../../../../shared/http/responses": {
					sendError: sendErrorStub,
				},
			}));
		});

		it("rejects doctor registration when department is missing", () => {
			const middleware = validate(schemas.register);
			const req = {
				body: {
					email: "doctor@example.com",
					password: "Strong@123",
					firstName: "Doc",
					lastName: "Tor",
					role: "doctor",
				},
			};
			const res = {};
			const next = sinon.spy();

			middleware(req, res, next);

			expect(sendErrorStub.calledOnce).to.equal(true);
			expect(sendErrorStub.firstCall.args[1]).to.equal(400);
			expect(sendErrorStub.firstCall.args[2]).to.equal("VALIDATION_ERROR");
			expect(next.called).to.equal(false);
		});

		it("normalizes and accepts nurse registration with departments", () => {
			const middleware = validate(schemas.register);
			const req = {
				body: {
					email: "nurse@example.com",
					password: "Strong@123",
					firstName: "Nurse",
					lastName: "One",
					role: "nurse",
					department: [" Pediatrics ", "ENT"],
				},
			};
			const res = {};
			const next = sinon.spy();

			middleware(req, res, next);

			expect(next.calledOnce).to.equal(true);
			expect(sendErrorStub.called).to.equal(false);
			expect(req.body.department).to.deep.equal(["Pediatrics", "ENT"]);
		});

		it("accepts valid login payload and strips unknown keys", () => {
			const middleware = validate(schemas.login);
			const req = {
				body: {
					email: "login@example.com",
					password: "pw",
					unexpected: "remove-me",
				},
			};
			const res = {};
			const next = sinon.spy();

			middleware(req, res, next);

			expect(next.calledOnce).to.equal(true);
			expect(req.body).to.deep.equal({
				email: "login@example.com",
				password: "pw",
			});
		});
	});

	describe("jwt utils", () => {
		it("generates token payload and extracts bearer token", () => {
			process.env.JWT_SECRET = "jwt-unit-secret";
			delete require.cache[require.resolve("../src/utils/jwt")];
			const { generateToken, verifyToken, extractTokenFromHeader } = require("../src/utils/jwt");

			const userId = new mongoose.Types.ObjectId();
			const token = generateToken({
				_id: userId,
				email: "jwt@example.com",
				role: "clerk",
				department: [],
			});

			const payload = verifyToken(token);
			expect(payload).to.include({
				userId: userId.toString(),
				email: "jwt@example.com",
				role: "clerk",
			});
			expect(extractTokenFromHeader(`Bearer ${token}`)).to.equal(token);
			expect(extractTokenFromHeader("Token abc")).to.equal(null);
		});

		it("throws explicit expiry message for expired token", () => {
			process.env.JWT_SECRET = "jwt-unit-secret";
			delete require.cache[require.resolve("../src/utils/jwt")];
			const { verifyToken } = require("../src/utils/jwt");

			const expiredToken = jwt.sign({ sub: "u1" }, process.env.JWT_SECRET, {
				expiresIn: -10,
			});

			expect(() => verifyToken(expiredToken)).to.throw("Token has expired");
		});
	});
});