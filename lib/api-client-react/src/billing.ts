import type {
  BillingSummary,
  PaymentRecord,
  Payment,
  CreatePaymentBody,
  UpdatePaymentBody,
  MessageResponse,
  SendPaymentReceiptWhatsapp200,
  PatientBillingOverview,
  ListPaymentsParams,
} from "./generated/api.schemas";
import {
  useQuery,
  useMutation,
  type QueryFunction,
  type MutationFunction,
  type UseQueryOptions,
  type UseMutationOptions,
  type UseQueryResult,
  type UseMutationResult,
  type QueryKey,
} from "@tanstack/react-query";
import { customFetch, type ErrorType, type BodyType } from "./custom-fetch";

type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];

export const getGetBillingSummaryUrl = () => {
  return `/api/billing/summary`;
};

export const getBillingSummary = async (
  options?: RequestInit,
): Promise<BillingSummary> => {
  return customFetch<BillingSummary>(getGetBillingSummaryUrl(), {
    ...options,
    method: "GET",
  });
};

export const getGetBillingSummaryQueryKey = () => {
  return [`/api/billing/summary`] as const;
};

export const getGetBillingSummaryQueryOptions = <
  TData = Awaited<ReturnType<typeof getBillingSummary>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: UseQueryOptions<
    Awaited<ReturnType<typeof getBillingSummary>>,
    TError,
    TData
  >;
  request?: SecondParameter<typeof customFetch>;
}) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};

  const queryKey = queryOptions?.queryKey ?? getGetBillingSummaryQueryKey();

  const queryFn: QueryFunction<
    Awaited<ReturnType<typeof getBillingSummary>>
  > = ({ signal }) => getBillingSummary({ signal, ...requestOptions });

  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof getBillingSummary>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export type GetBillingSummaryQueryResult = NonNullable<
  Awaited<ReturnType<typeof getBillingSummary>>
>;
export type GetBillingSummaryQueryError = ErrorType<unknown>;

/**
 * @summary Billing dashboard summary
 */

export function useGetBillingSummary<
  TData = Awaited<ReturnType<typeof getBillingSummary>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: UseQueryOptions<
    Awaited<ReturnType<typeof getBillingSummary>>,
    TError,
    TData
  >;
  request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getGetBillingSummaryQueryOptions(options);

  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };

  return { ...query, queryKey: queryOptions.queryKey };
}

/**
 * @summary List payments and abonos
 */
export const getListPaymentsUrl = (params?: ListPaymentsParams) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      normalizedParams.append(key, value === null ? "null" : value.toString());
    }
  });

  const stringifiedParams = normalizedParams.toString();

  return stringifiedParams.length > 0
    ? `/api/billing/payments?${stringifiedParams}`
    : `/api/billing/payments`;
};

export const listPayments = async (
  params?: ListPaymentsParams,
  options?: RequestInit,
): Promise<PaymentRecord[]> => {
  return customFetch<PaymentRecord[]>(getListPaymentsUrl(params), {
    ...options,
    method: "GET",
  });
};

export const getListPaymentsQueryKey = (params?: ListPaymentsParams) => {
  return [`/api/billing/payments`, ...(params ? [params] : [])] as const;
};

export const getListPaymentsQueryOptions = <
  TData = Awaited<ReturnType<typeof listPayments>>,
  TError = ErrorType<unknown>,
>(
  params?: ListPaymentsParams,
  options?: {
    query?: UseQueryOptions<
      Awaited<ReturnType<typeof listPayments>>,
      TError,
      TData
    >;
    request?: SecondParameter<typeof customFetch>;
  },
) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};

  const queryKey = queryOptions?.queryKey ?? getListPaymentsQueryKey(params);

  const queryFn: QueryFunction<Awaited<ReturnType<typeof listPayments>>> = ({
    signal,
  }) => listPayments(params, { signal, ...requestOptions });

  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof listPayments>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export type ListPaymentsQueryResult = NonNullable<
  Awaited<ReturnType<typeof listPayments>>
>;
export type ListPaymentsQueryError = ErrorType<unknown>;

/**
 * @summary List payments and abonos
 */

export function useListPayments<
  TData = Awaited<ReturnType<typeof listPayments>>,
  TError = ErrorType<unknown>,
>(
  params?: ListPaymentsParams,
  options?: {
    query?: UseQueryOptions<
      Awaited<ReturnType<typeof listPayments>>,
      TError,
      TData
    >;
    request?: SecondParameter<typeof customFetch>;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getListPaymentsQueryOptions(params, options);

  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };

  return { ...query, queryKey: queryOptions.queryKey };
}

/**
 * @summary Register a payment or abono
 */
export const getCreatePaymentUrl = () => {
  return `/api/billing/payments`;
};

export const createPayment = async (
  createPaymentBody: CreatePaymentBody,
  options?: RequestInit,
): Promise<Payment> => {
  return customFetch<Payment>(getCreatePaymentUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(createPaymentBody),
  });
};

export const getCreatePaymentMutationOptions = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof createPayment>>,
    TError,
    { data: BodyType<CreatePaymentBody> },
    TContext
  >;
  request?: SecondParameter<typeof customFetch>;
}): UseMutationOptions<
  Awaited<ReturnType<typeof createPayment>>,
  TError,
  { data: BodyType<CreatePaymentBody> },
  TContext
> => {
  const mutationKey = ["createPayment"];
  const { mutation: mutationOptions, request: requestOptions } = options
    ? options.mutation &&
      "mutationKey" in options.mutation &&
      options.mutation.mutationKey
      ? options
      : { ...options, mutation: { ...options.mutation, mutationKey } }
    : { mutation: { mutationKey }, request: undefined };

  const mutationFn: MutationFunction<
    Awaited<ReturnType<typeof createPayment>>,
    { data: BodyType<CreatePaymentBody> }
  > = (props) => {
    const { data } = props ?? {};

    return createPayment(data, requestOptions);
  };

  return { mutationFn, ...mutationOptions };
};

export type CreatePaymentMutationResult = NonNullable<
  Awaited<ReturnType<typeof createPayment>>
>;
export type CreatePaymentMutationBody = BodyType<CreatePaymentBody>;
export type CreatePaymentMutationError = ErrorType<unknown>;

/**
 * @summary Register a payment or abono
 */
export const useCreatePayment = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof createPayment>>,
    TError,
    { data: BodyType<CreatePaymentBody> },
    TContext
  >;
  request?: SecondParameter<typeof customFetch>;
}): UseMutationResult<
  Awaited<ReturnType<typeof createPayment>>,
  TError,
  { data: BodyType<CreatePaymentBody> },
  TContext
> => {
  return useMutation(getCreatePaymentMutationOptions(options));
};

/**
 * @summary Update payment
 */
export const getUpdatePaymentUrl = (id: number) => {
  return `/api/billing/payments/${id}`;
};

export const updatePayment = async (
  id: number,
  updatePaymentBody: UpdatePaymentBody,
  options?: RequestInit,
): Promise<Payment> => {
  return customFetch<Payment>(getUpdatePaymentUrl(id), {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(updatePaymentBody),
  });
};

export const getUpdatePaymentMutationOptions = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof updatePayment>>,
    TError,
    { id: number; data: BodyType<UpdatePaymentBody> },
    TContext
  >;
  request?: SecondParameter<typeof customFetch>;
}): UseMutationOptions<
  Awaited<ReturnType<typeof updatePayment>>,
  TError,
  { id: number; data: BodyType<UpdatePaymentBody> },
  TContext
> => {
  const mutationKey = ["updatePayment"];
  const { mutation: mutationOptions, request: requestOptions } = options
    ? options.mutation &&
      "mutationKey" in options.mutation &&
      options.mutation.mutationKey
      ? options
      : { ...options, mutation: { ...options.mutation, mutationKey } }
    : { mutation: { mutationKey }, request: undefined };

  const mutationFn: MutationFunction<
    Awaited<ReturnType<typeof updatePayment>>,
    { id: number; data: BodyType<UpdatePaymentBody> }
  > = (props) => {
    const { id, data } = props ?? {};

    return updatePayment(id, data, requestOptions);
  };

  return { mutationFn, ...mutationOptions };
};

export type UpdatePaymentMutationResult = NonNullable<
  Awaited<ReturnType<typeof updatePayment>>
>;
export type UpdatePaymentMutationBody = BodyType<UpdatePaymentBody>;
export type UpdatePaymentMutationError = ErrorType<unknown>;

/**
 * @summary Update payment
 */
export const useUpdatePayment = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof updatePayment>>,
    TError,
    { id: number; data: BodyType<UpdatePaymentBody> },
    TContext
  >;
  request?: SecondParameter<typeof customFetch>;
}): UseMutationResult<
  Awaited<ReturnType<typeof updatePayment>>,
  TError,
  { id: number; data: BodyType<UpdatePaymentBody> },
  TContext
> => {
  return useMutation(getUpdatePaymentMutationOptions(options));
};

/**
 * @summary Delete payment
 */
export const getDeletePaymentUrl = (id: number) => {
  return `/api/billing/payments/${id}`;
};

export const deletePayment = async (
  id: number,
  options?: RequestInit,
): Promise<MessageResponse> => {
  return customFetch<MessageResponse>(getDeletePaymentUrl(id), {
    ...options,
    method: "DELETE",
  });
};

export const getDeletePaymentMutationOptions = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof deletePayment>>,
    TError,
    { id: number },
    TContext
  >;
  request?: SecondParameter<typeof customFetch>;
}): UseMutationOptions<
  Awaited<ReturnType<typeof deletePayment>>,
  TError,
  { id: number },
  TContext
> => {
  const mutationKey = ["deletePayment"];
  const { mutation: mutationOptions, request: requestOptions } = options
    ? options.mutation &&
      "mutationKey" in options.mutation &&
      options.mutation.mutationKey
      ? options
      : { ...options, mutation: { ...options.mutation, mutationKey } }
    : { mutation: { mutationKey }, request: undefined };

  const mutationFn: MutationFunction<
    Awaited<ReturnType<typeof deletePayment>>,
    { id: number }
  > = (props) => {
    const { id } = props ?? {};

    return deletePayment(id, requestOptions);
  };

  return { mutationFn, ...mutationOptions };
};

export type DeletePaymentMutationResult = NonNullable<
  Awaited<ReturnType<typeof deletePayment>>
>;

export type DeletePaymentMutationError = ErrorType<unknown>;

/**
 * @summary Delete payment
 */
export const useDeletePayment = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof deletePayment>>,
    TError,
    { id: number },
    TContext
  >;
  request?: SecondParameter<typeof customFetch>;
}): UseMutationResult<
  Awaited<ReturnType<typeof deletePayment>>,
  TError,
  { id: number },
  TContext
> => {
  return useMutation(getDeletePaymentMutationOptions(options));
};

/**
 * @summary Send payment receipt image via WhatsApp
 */
export const getSendPaymentReceiptWhatsappUrl = (id: number) => {
  return `/api/billing/payments/${id}/send-whatsapp`;
};

export const sendPaymentReceiptWhatsapp = async (
  id: number,
  options?: RequestInit,
): Promise<SendPaymentReceiptWhatsapp200> => {
  return customFetch<SendPaymentReceiptWhatsapp200>(
    getSendPaymentReceiptWhatsappUrl(id),
    {
      ...options,
      method: "POST",
    },
  );
};

export const getSendPaymentReceiptWhatsappMutationOptions = <
  TError = ErrorType<void>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof sendPaymentReceiptWhatsapp>>,
    TError,
    { id: number },
    TContext
  >;
  request?: SecondParameter<typeof customFetch>;
}): UseMutationOptions<
  Awaited<ReturnType<typeof sendPaymentReceiptWhatsapp>>,
  TError,
  { id: number },
  TContext
> => {
  const mutationKey = ["sendPaymentReceiptWhatsapp"];
  const { mutation: mutationOptions, request: requestOptions } = options
    ? options.mutation &&
      "mutationKey" in options.mutation &&
      options.mutation.mutationKey
      ? options
      : { ...options, mutation: { ...options.mutation, mutationKey } }
    : { mutation: { mutationKey }, request: undefined };

  const mutationFn: MutationFunction<
    Awaited<ReturnType<typeof sendPaymentReceiptWhatsapp>>,
    { id: number }
  > = (props) => {
    const { id } = props ?? {};

    return sendPaymentReceiptWhatsapp(id, requestOptions);
  };

  return { mutationFn, ...mutationOptions };
};

export type SendPaymentReceiptWhatsappMutationResult = NonNullable<
  Awaited<ReturnType<typeof sendPaymentReceiptWhatsapp>>
>;

export type SendPaymentReceiptWhatsappMutationError = ErrorType<void>;

/**
 * @summary Send payment receipt image via WhatsApp
 */
export const useSendPaymentReceiptWhatsapp = <
  TError = ErrorType<void>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof sendPaymentReceiptWhatsapp>>,
    TError,
    { id: number },
    TContext
  >;
  request?: SecondParameter<typeof customFetch>;
}): UseMutationResult<
  Awaited<ReturnType<typeof sendPaymentReceiptWhatsapp>>,
  TError,
  { id: number },
  TContext
> => {
  return useMutation(getSendPaymentReceiptWhatsappMutationOptions(options));
};

/**
 * @summary Patient billing overview
 */
export const getGetPatientBillingUrl = (patientId: number) => {
  return `/api/billing/patient/${patientId}`;
};

export const getPatientBilling = async (
  patientId: number,
  options?: RequestInit,
): Promise<PatientBillingOverview> => {
  return customFetch<PatientBillingOverview>(
    getGetPatientBillingUrl(patientId),
    {
      ...options,
      method: "GET",
    },
  );
};

export const getGetPatientBillingQueryKey = (patientId: number) => {
  return [`/api/billing/patient/${patientId}`] as const;
};

export const getGetPatientBillingQueryOptions = <
  TData = Awaited<ReturnType<typeof getPatientBilling>>,
  TError = ErrorType<unknown>,
>(
  patientId: number,
  options?: {
    query?: UseQueryOptions<
      Awaited<ReturnType<typeof getPatientBilling>>,
      TError,
      TData
    >;
    request?: SecondParameter<typeof customFetch>;
  },
) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};

  const queryKey =
    queryOptions?.queryKey ?? getGetPatientBillingQueryKey(patientId);

  const queryFn: QueryFunction<
    Awaited<ReturnType<typeof getPatientBilling>>
  > = ({ signal }) =>
    getPatientBilling(patientId, { signal, ...requestOptions });

  return {
    queryKey,
    queryFn,
    enabled: !!patientId,
    ...queryOptions,
  } as UseQueryOptions<
    Awaited<ReturnType<typeof getPatientBilling>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export type GetPatientBillingQueryResult = NonNullable<
  Awaited<ReturnType<typeof getPatientBilling>>
>;
export type GetPatientBillingQueryError = ErrorType<unknown>;

/**
 * @summary Patient billing overview
 */

export function useGetPatientBilling<
  TData = Awaited<ReturnType<typeof getPatientBilling>>,
  TError = ErrorType<unknown>,
>(
  patientId: number,
  options?: {
    query?: UseQueryOptions<
      Awaited<ReturnType<typeof getPatientBilling>>,
      TError,
      TData
    >;
    request?: SecondParameter<typeof customFetch>;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getGetPatientBillingQueryOptions(patientId, options);

  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };

  return { ...query, queryKey: queryOptions.queryKey };
}

/**
 * @summary List AI knowledge entries
 */

