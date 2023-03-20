import { Function } from "./function";
import { ISimulatorResource } from "./resource";
import { BaseResourceSchema } from "./schema";
import { ApiSchema, API_TYPE } from "./schema-resources";
import {
  bindSimulatorResource,
  makeSimulatorJsClient,
  simulatorHandleToken,
} from "./util";
import * as cloud from "../cloud";
import * as core from "../core";

/**
 * Simulator implementation of `cloud.Api`.
 *
 * @inflight `@winglang/sdk.cloud.IApiClient`
 */
export class Api extends cloud.Api implements ISimulatorResource {
  private _routes: ApiSchema["props"]["routes"] = [];

  private createOrGetFunction(
    inflight: core.Inflight,
    props: cloud.FunctionProps
  ): Function {
    const hash = inflight.node.addr.slice(-8);
    const fnPath = `${this.node.id}-OnRequestHandler-${hash}`;

    let existingFn = this.node.tryFindChild(fnPath);
    if (existingFn) {
      return existingFn as Function;
    }

    const fn = Function._newFunction(this, fnPath, inflight, props) as Function;

    // Api needs to be deployed after functions in the simulator so that the
    // function handles will be available.
    this.node.addDependency(fn);

    return fn;
  }

  private addEndpoint(
    route: string,
    method: cloud.HttpMethod,
    inflight: core.Inflight,
    props: any
  ): void {
    this._addToSpec(route, method, undefined);

    const fn = this.createOrGetFunction(inflight, props);

    const functionHandle = simulatorHandleToken(fn);
    this._routes.push({
      route,
      method,
      functionHandle,
    });

    core.Resource.addConnection({
      from: this,
      to: fn,
      relationship: `on_${method.toLowerCase()}_request`,
    });
  }

  /**
   * Add a inflight to handle GET requests to a route.
   * @param route Route to add
   * @param inflight Inflight to handle request
   * @param props Additional props
   */
  public get(
    route: string,
    inflight: core.Inflight,
    props?: cloud.ApiGetProps | undefined
  ): void {
    this.addEndpoint(route, cloud.HttpMethod.GET, inflight, props);
  }

  /**
   * Add a inflight to handle POST requests to a route.
   * @param route Route to add
   * @param inflight Inflight to handle request
   * @param props Additional props
   */
  public post(
    route: string,
    inflight: core.Inflight,
    props?: cloud.ApiPostProps | undefined
  ): void {
    this.addEndpoint(route, cloud.HttpMethod.POST, inflight, props);
  }

  /**
   * Add a inflight to handle PUT requests to a route.
   * @param route Route to add
   * @param inflight Inflight to handle request
   * @param props Additional props
   */
  public put(
    route: string,
    inflight: core.Inflight,
    props?: cloud.ApiPutProps | undefined
  ): void {
    this.addEndpoint(route, cloud.HttpMethod.PUT, inflight, props);
  }

  /**
   * Add a inflight to handle DELETE requests to a route.
   * @param route Route to add
   * @param inflight Inflight to handle request
   * @param props Additional props
   */
  public delete(
    route: string,
    inflight: core.Inflight,
    props?: cloud.ApiDeleteProps | undefined
  ): void {
    this.addEndpoint(route, cloud.HttpMethod.DELETE, inflight, props);
  }

  /**
   * Add a inflight to handle PATCH requests to a route.
   * @param route Route to add
   * @param inflight Inflight to handle request
   * @param props Additional props
   */
  public patch(
    route: string,
    inflight: core.Inflight,
    props?: cloud.ApiPatchProps | undefined
  ): void {
    this.addEndpoint(route, cloud.HttpMethod.PATCH, inflight, props);
  }

  /**
   * Add a inflight to handle OPTIONS requests to a route.
   * @param route Route to add
   * @param inflight Inflight to handle request
   * @param props Additional props
   */
  public options(
    route: string,
    inflight: core.Inflight,
    props?: cloud.ApiOptionsProps | undefined
  ): void {
    this.addEndpoint(route, cloud.HttpMethod.OPTIONS, inflight, props);
  }

  /**
   * Add a inflight to handle HEAD requests to a route.
   * @param route Route to add
   * @param inflight Inflight to handle request
   * @param props Additional props
   */
  public head(
    route: string,
    inflight: core.Inflight,
    props?: cloud.ApiHeadProps | undefined
  ): void {
    this.addEndpoint(route, cloud.HttpMethod.HEAD, inflight, props);
  }

  /**
   * Add a inflight to handle CONNECT requests to a route.
   * @param route Route to add
   * @param inflight Inflight to handle request
   * @param props Additional props
   */
  public connect(
    route: string,
    inflight: core.Inflight,
    props?: cloud.ApiConnectProps | undefined
  ): void {
    this.addEndpoint(route, cloud.HttpMethod.CONNECT, inflight, props);
  }

  public toSimulator(): BaseResourceSchema {
    const schema: ApiSchema = {
      type: API_TYPE,
      path: this.node.path,
      props: {
        routes: this._routes,
      },
      attrs: {} as any,
    };
    return schema;
  }

  /** @internal */
  public _toInflight(): core.Code {
    return makeSimulatorJsClient("bucket", this);
  }

  /** @internal */
  public _bind(host: core.IInflightHost, ops: string[]): void {
    bindSimulatorResource("api", this, host);
    super._bind(host, ops);
  }
}
