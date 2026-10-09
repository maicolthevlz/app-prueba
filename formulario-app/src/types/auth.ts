export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
};

export type DnnAuthenticationResponse = {
  success: boolean;
  message?: string;
  token?: {
    issuer?: string;
    audience?: string;
    policy?: string;
    expires?: string;
    notBefore?: string;
  };
  user?: {
    oid?: string;
    subject?: string;
    email?: string;
    name?: string;
    givenName?: string;
    familyName?: string;
  };
};
