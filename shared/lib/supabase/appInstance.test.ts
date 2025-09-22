import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearCachedAppInstance, getActiveAppInstance, getActiveAppInstanceId } from "./appInstance";

type MockFn = ReturnType<typeof vi.fn>;

type SupabaseStub = {
  selectMock: MockFn;
  eqMock: MockFn;
  orderMock: MockFn;
  limitMock: MockFn;
  maybeSingleMock: MockFn;
  fromMock: MockFn;
  createClientMock: MockFn;
  configure: () => void;
};

const supabaseStub = vi.hoisted<SupabaseStub>(() => {
  const selectMock = vi.fn();
  const eqMock = vi.fn();
  const orderMock = vi.fn();
  const limitMock = vi.fn();
  const maybeSingleMock = vi.fn();
  const fromMock = vi.fn();
  const createClientMock = vi.fn();

  let queryBuilder: {
    select: MockFn;
    eq: MockFn;
    order: MockFn;
    limit: MockFn;
    maybeSingle: MockFn;
  } | null = null;

  const configure = () => {
    queryBuilder = {
      select: selectMock,
      eq: eqMock,
      order: orderMock,
      limit: limitMock,
      maybeSingle: maybeSingleMock,
    };

    selectMock.mockImplementation(() => queryBuilder);
    eqMock.mockImplementation(() => queryBuilder);
    orderMock.mockImplementation(() => queryBuilder);
    limitMock.mockImplementation(() => queryBuilder);
    fromMock.mockImplementation(() => queryBuilder);
    createClientMock.mockReturnValue({ from: fromMock });
  };

  configure();

  return {
    selectMock,
    eqMock,
    orderMock,
    limitMock,
    maybeSingleMock,
    fromMock,
    createClientMock,
    configure,
  } satisfies SupabaseStub;
});

vi.mock("@shared/lib/supabase/client", () => {
  supabaseStub.configure();
  return {
    createClient: supabaseStub.createClientMock,
  };
});

const clearMocks = () => {
  supabaseStub.selectMock.mockClear();
  supabaseStub.eqMock.mockClear();
  supabaseStub.orderMock.mockClear();
  supabaseStub.limitMock.mockClear();
  supabaseStub.maybeSingleMock.mockClear();
  supabaseStub.fromMock.mockClear();
  supabaseStub.createClientMock.mockClear();
  supabaseStub.configure();
};

describe("getActiveAppInstance", () => {
  beforeEach(() => {
    clearMocks();
    clearCachedAppInstance();
    process.env.NEXT_PUBLIC_APP_NAME = "wallet";
    process.env.NEXT_PUBLIC_CITYCOIN = "tcoin";
    delete process.env.NEXT_PUBLIC_APP_ENVIRONMENT;
    delete process.env.NEXT_PUBLIC_DEPLOY_ENV;
    delete process.env.NEXT_PUBLIC_ENV;
  });

  afterEach(() => {
    clearCachedAppInstance();
  });

  it("filters by environment when one is provided", async () => {
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT = "staging";

    supabaseStub.maybeSingleMock.mockResolvedValue({
      data: { id: 42, slug: "wallet-tcoin-staging", environment: "staging" },
      error: null,
    });

    const instance = await getActiveAppInstance();
    expect(instance).toEqual({ id: 42, slug: "wallet-tcoin-staging", environment: "staging" });

    expect(supabaseStub.createClientMock).toHaveBeenCalledTimes(1);
    expect(supabaseStub.fromMock).toHaveBeenCalledWith("app_instances");
    expect(supabaseStub.selectMock).toHaveBeenCalledWith(
      "id, slug, environment, apps!inner(slug), citycoins!inner(slug)"
    );
    expect(supabaseStub.eqMock).toHaveBeenCalledWith("environment", "staging");
    expect(supabaseStub.orderMock).not.toHaveBeenCalled();
  });

  it("falls back to defaults, orders by environment, and caches the lookup", async () => {
    supabaseStub.maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const firstCall = await getActiveAppInstance();
    const secondCall = await getActiveAppInstanceId();

    expect(firstCall).toBeNull();
    expect(secondCall).toBeNull();

    expect(supabaseStub.eqMock).toHaveBeenNthCalledWith(1, "apps.slug", "wallet");
    expect(supabaseStub.eqMock).toHaveBeenNthCalledWith(2, "citycoins.slug", "tcoin");
    expect(supabaseStub.orderMock).toHaveBeenCalledWith("environment", { ascending: true });
    expect(supabaseStub.maybeSingleMock).toHaveBeenCalledTimes(1);
  });
});
