import type { TaxPreset } from "./types.ts";

export const UK_PRESET: TaxPreset = {
  country: "GB",
  label: "United Kingdom (VAT)",
  description: '20%, 5%, zero-rated and exempt; "VAT invoice" title.',
  rates: [
    { name: "VAT 20%", rate: 20, taxType: "vat" },
    { name: "VAT 5%", rate: 5, taxType: "vat" },
    { name: "VAT 0%", rate: 0, taxType: "vat", supplyClass: "zero_rated" },
    { name: "Exempt", rate: 0, taxType: "vat", supplyClass: "exempt" },
  ],
  groups: [],
  invoiceTitle: "VAT invoice",
};

export const AUSTRALIA_PRESET: TaxPreset = {
  country: "AU",
  label: "Australia (GST)",
  description: "10%, GST-free and exempt.",
  rates: [
    { name: "GST 10%", rate: 10, taxType: "gst" },
    { name: "GST-free", rate: 0, taxType: "gst", supplyClass: "zero_rated" },
    { name: "Exempt", rate: 0, taxType: "gst", supplyClass: "exempt" },
  ],
  groups: [],
  invoiceTitle: "Tax invoice",
};

export const NEW_ZEALAND_PRESET: TaxPreset = {
  country: "NZ",
  label: "New Zealand (GST)",
  description: "15%, zero-rated and exempt.",
  rates: [
    { name: "GST 15%", rate: 15, taxType: "gst" },
    { name: "GST 0%", rate: 0, taxType: "gst", supplyClass: "zero_rated" },
    { name: "Exempt", rate: 0, taxType: "gst", supplyClass: "exempt" },
  ],
  groups: [],
  invoiceTitle: "Tax invoice",
};

export const UAE_PRESET: TaxPreset = {
  country: "AE",
  label: "United Arab Emirates (VAT)",
  description: "5%, zero-rated and exempt.",
  rates: [
    { name: "VAT 5%", rate: 5, taxType: "vat" },
    { name: "VAT 0%", rate: 0, taxType: "vat", supplyClass: "zero_rated" },
    { name: "Exempt", rate: 0, taxType: "vat", supplyClass: "exempt" },
  ],
  groups: [],
  invoiceTitle: "Tax invoice",
};

export const SAUDI_ARABIA_PRESET: TaxPreset = {
  country: "SA",
  label: "Saudi Arabia (VAT)",
  description: "15%, zero-rated and exempt.",
  rates: [
    { name: "VAT 15%", rate: 15, taxType: "vat" },
    { name: "VAT 0%", rate: 0, taxType: "vat", supplyClass: "zero_rated" },
    { name: "Exempt", rate: 0, taxType: "vat", supplyClass: "exempt" },
  ],
  groups: [],
  invoiceTitle: "Tax invoice",
};
