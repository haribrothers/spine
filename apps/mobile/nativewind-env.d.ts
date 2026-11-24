/// <reference types="nativewind/types" />

/** NativeWind's own global.css side-effect import — Metro handles it at bundle time; tsc just needs to know the module exists. */
declare module "*.css";
