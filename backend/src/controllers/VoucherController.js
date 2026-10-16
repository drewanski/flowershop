const VOUCHER_RESPONSES = require('../responses/VoucherResponses').codes;
const GENERIC_RESPONSES = require('../constants/GenericResponseConstants');
const VoucherService = require('../services/VoucherService');
const OrderService = require('../services/OrderService');
const VoucherResponses = require('../responses/VoucherResponses');

const send = (res, response) => {
  const code = response.code;
  const status = code === VOUCHER_RESPONSES.success.code
    ? 200
    : code === VOUCHER_RESPONSES.notFound.code
      ? 404
      : code === VOUCHER_RESPONSES.conflict.code
        ? 409
        : code === GENERIC_RESPONSES.internalServerError.code
          ? 500
          : 400;

  return res.status(status).json(response);
};

const getVouchers = async (req, res) =>
  send(res, await VoucherService.getVouchers(req.query));

const getVoucher = async (req, res) =>
  send(res, await VoucherService.getVoucher(req.params.id));

const createVoucher = async (req, res) =>
  send(res, await VoucherService.createVoucher(req.body, req.user._id));

const updateVoucher = async (req, res) =>
  send(res, await VoucherService.updateVoucher(req.params.id, req.body, req.user._id));

const deleteVoucher = async (req, res) =>
  send(res, await VoucherService.deleteVoucher(req.params.id));

const claimVoucher = async (req, res) =>
  send(res, await VoucherService.claimVoucher(req.body.code, req.user._id));

const previewVoucherApplication = async (req, res) => {
  const result = await OrderService.previewVoucherApplication(req.body, req.user._id);
  if (result.code === 300) {
    return send(res, VoucherResponses.success(result.payload, result.message));
  }
  return res.status(400).json(result);
};

const getCustomerVouchers = async (req, res) =>
  send(res, await VoucherService.getCustomerVouchers(req.user._id));

const getAvailableVoucherCampaigns = async (req, res) =>
  send(res, await VoucherService.getAvailableVoucherCampaigns(req.user._id));

const getCustomerVoucher = async (req, res) =>
  send(res, await VoucherService.getCustomerVoucher(req.params.id, req.user._id));

module.exports = {
  getVouchers,
  getVoucher,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  claimVoucher,
  previewVoucherApplication,
  getCustomerVouchers,
  getCustomerVoucher,
  getAvailableVoucherCampaigns,
};
